import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { JOBS, getJob, getUnlockedJobs } from '../../utils/jobs.js';
import { checkAndAnnounceAchievements } from '../../config/achievements.js';

const WORK_COOLDOWN = 45 * 60 * 1000; // 45 minutes in milliseconds
const LAPTOP_MULTIPLIER = 1.5;
const JOBS_PER_PAGE = 4;

export default {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work to earn some money')
        .addSubcommand(subcommand =>
            subcommand
                .setName('shift')
                .setDescription('Start a work shift with your current job')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('select')
                .setDescription('Select a new job to work at')
                .addStringOption(option =>
                    option.setName('job')
                        .setDescription('The job you want to select')
                        .setRequired(false)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('View all available jobs and their requirements')
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = JOBS.map(job => ({ name: job.name, value: job.id }));
        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue));
        await interaction.respond(filtered.slice(0, 25));
    },

    execute: withErrorHandling(async (interaction, config, client) => {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const now = Date.now();

        const userData = await getEconomyData(client, guildId, userId);

        if (!userData) {
            throw createError(
                "Failed to load economy data for work",
                ErrorTypes.DATABASE,
                "Failed to load your economy data. Please try again later.",
                { userId, guildId }
            );
        }

        if (subcommand === 'list') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const shifts = userData.shifts || 0;
            const totalPages = Math.ceil(JOBS.length / JOBS_PER_PAGE);
            let currentPage = 0;

            const createJobsEmbed = (page) => {
                const start = page * JOBS_PER_PAGE;
                const end = start + JOBS_PER_PAGE;
                const pageJobs = JOBS.slice(start, end);

                const embed = infoEmbed(
                    "💼 Available Jobs",
                    `Total Jobs: **${JOBS.length}** • Your Shifts: **${shifts}**\n\n` +
                    pageJobs.map(j => {
                        let isUnlocked, status, statusIcon;

                        if (j.bankRequired) {
                            isUnlocked = userData.wallet >= j.bankRequired;
                            status = isUnlocked ? "Unlocked" : `$${j.bankRequired.toLocaleString()}`;
                        } else {
                            isUnlocked = shifts >= j.shiftsRequired;
                            status = isUnlocked ? "Unlocked" : `${j.shiftsRequired} shifts`;
                        }
                        statusIcon = isUnlocked ? "✅" : "🔒";

                        return `${j.emoji} **${j.name}**\n` +
                               `\`Pay: $${j.minPay}-$${j.maxPay}\` • \`${statusIcon} ${status}\``;
                    }).join('\n\n')
                );
                embed.setFooter({ text: `Page ${page + 1} of ${totalPages}` });
                return embed;
            };

            const createButtons = (page) => {
                const row = new ActionRowBuilder();
                
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev_jobs')
                        .setEmoji('⬅️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('next_jobs')
                        .setEmoji('➡️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages - 1)
                );
                
                return row;
            };

            const response = await InteractionHelper.safeEditReply(interaction, {
                embeds: [createJobsEmbed(currentPage)],
                components: [createButtons(currentPage)],
                fetchReply: true
            });

            if (!response) return;

            const collector = response.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 60000
            });

            collector.on('collect', async i => {
                if (i.customId === 'prev_jobs') currentPage--;
                else if (i.customId === 'next_jobs') currentPage++;

                await i.update({
                    embeds: [createJobsEmbed(currentPage)],
                    components: [createButtons(currentPage)]
                });
            });

            collector.on('end', () => {
                InteractionHelper.safeEditReply(interaction, { components: [] }).catch(() => {});
            });

            return;
        }

        if (subcommand === 'select') {
            const jobOption = interaction.options.getString('job');

            if (jobOption) {
                const deferred = await InteractionHelper.safeDefer(interaction);
                if (!deferred) return;

                const job = getJob(jobOption);
                const shifts = userData.shifts || 0;
                const wallet = userData.wallet || 0;

                if (job.bankRequired) {
                    if (wallet < job.bankRequired) {
                        throw createError(
                            "Job Locked",
                            ErrorTypes.VALIDATION,
                            `You need **$${job.bankRequired.toLocaleString()}** in your wallet to unlock the **${job.name}** job. You currently have **$${wallet.toLocaleString()}**.`,
                            { jobId: job.id, bankRequired: job.bankRequired, currentWallet: wallet }
                        );
                    }
                } else {
                    if (shifts < job.shiftsRequired) {
                        throw createError(
                            "Job Locked",
                            ErrorTypes.VALIDATION,
                            `You need **${job.shiftsRequired}** total shifts to unlock the **${job.name}** job. You currently have **${shifts}** shifts.`,
                            { jobId: job.id, shiftsRequired: job.shiftsRequired, currentShifts: shifts }
                        );
                    }
                }

                userData.job = job.id;
                await setEconomyData(client, guildId, userId, userData);

                const embed = successEmbed(
                    "💼 Job Updated",
                    `You are now working as a **${job.name}** ${job.emoji}!\n` +
                    `└ Pay: $${job.minPay}-$${job.maxPay} per shift.`
                );

                return await InteractionHelper.safeEditReply(interaction, {
                    embeds: [embed],
                    components: []
                });
            }

            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const shifts = userData.shifts || 0;
            const wallet = userData.wallet || 0;
            const currentJobId = userData.job || 'janitor';
            const unlockedJobs = getUnlockedJobs(shifts, wallet);

            const embed = infoEmbed(
                "💼 Job Selection",
                `Select a job you'd like to work at. You currently have **${shifts}** total shifts and **$${wallet.toLocaleString()}** in your wallet.\n\n` +
                JOBS.map(j => {
                    let isUnlocked, unlockInfo;

                    if (j.bankRequired) {
                        isUnlocked = wallet >= j.bankRequired;
                        unlockInfo = isUnlocked ? "✅ Unlocked" : `🔒 Locked ($${j.bankRequired.toLocaleString()} required)`;
                    } else {
                        isUnlocked = shifts >= j.shiftsRequired;
                        unlockInfo = isUnlocked ? "✅ Unlocked" : `🔒 Locked (${j.shiftsRequired} shifts required)`;
                    }

                    const isCurrent = j.id === currentJobId;
                    return `${j.emoji} **${j.name}** ${isCurrent ? "*(Current)*" : ""}\n` +
                           `└ Pay: $${j.minPay}-$${j.maxPay} | ${unlockInfo}`;
                }).join('\n\n')
            );

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('job_select')
                .setPlaceholder('Choose your job...')
                .addOptions(
                    JOBS.map(j => {
                        let isUnlocked;
                        if (j.bankRequired) {
                            isUnlocked = wallet >= j.bankRequired;
                        } else {
                            isUnlocked = shifts >= j.shiftsRequired;
                        }

                        return new StringSelectMenuOptionBuilder()
                            .setLabel(j.name)
                            .setDescription(j.description)
                            .setValue(j.id)
                            .setEmoji(j.emoji)
                            .setDefault(j.id === currentJobId)
                            .setDisabled(!isUnlocked);
                    })
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed],
                components: [row]
            });
        }

        if (subcommand === 'shift') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            logger.debug(`[ECONOMY] Work shift started for ${userId}`, { userId, guildId });

            const lastWork = userData.lastWork || 0;
            const inventory = userData.inventory || {};
            const extraWorkShifts = inventory["extra_work"] || 0;
            const hasLaptop = inventory["laptop"] || 0;

            let cooldownActive = now < lastWork + WORK_COOLDOWN;
            let usedConsumable = false;

            if (cooldownActive) {
                if (extraWorkShifts > 0) {
                    inventory["extra_work"] = (inventory["extra_work"] || 0) - 1;
                    usedConsumable = true;
                } else {
                    const remaining = lastWork + WORK_COOLDOWN - now;
                    throw createError(
                        "Work cooldown active",
                        ErrorTypes.RATE_LIMIT,
                        `You're working too fast! Wait **${Math.floor(remaining / 3600000)}h ${Math.floor((remaining % 3600000) / 60000)}m** before working again.`,
                        { timeRemaining: remaining, cooldownType: 'work' }
                    );
                }
            }

            const currentJobId = userData.job || 'janitor';
            const job = getJob(currentJobId);
            
            let earned = Math.floor(Math.random() * (job.maxPay - job.minPay + 1)) + job.minPay;
            
            let multiplierMessage = "";
            if (hasLaptop > 0) {
                earned = Math.floor(earned * LAPTOP_MULTIPLIER);
                multiplierMessage = "\n💻 **Laptop Bonus:** +50% earnings!";
            }

            userData.wallet = (userData.wallet || 0) + earned;
            userData.lastWork = now;
            userData.shifts = (userData.shifts || 0) + 1;

            await checkAndAnnounceAchievements(client, interaction.guild, interaction.member, userData);

            await setEconomyData(client, guildId, userId, userData);

            logger.info(`[ECONOMY_TRANSACTION] Work shift completed`, {
                userId,
                guildId,
                amount: earned,
                job: job.name,
                shifts: userData.shifts,
                usedConsumable,
                hasLaptop: hasLaptop > 0,
                newWallet: userData.wallet,
                timestamp: new Date().toISOString()
            });

            const embed = successEmbed(
                "💼 Shift Complete!",
                `You worked as a **${job.name}** and earned **$${earned.toLocaleString()}**!${multiplierMessage}`
            )
                .addFields(
                    {
                        name: "💰 New Balance",
                        value: `$${userData.wallet.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: "📈 Total Shifts",
                        value: `${userData.shifts}`,
                        inline: true,
                    },
                    {
                        name: "⏰ Next Shift",
                        value: `<t:${Math.floor((now + WORK_COOLDOWN) / 1000)}:R>`,
                        inline: true,
                    }
                )
                .setFooter({
                    text: `Requested by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL(),
                });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }
    }, { command: 'work' })
};





