import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { JOBS, getJob, getUnlockedJobs } from '../../utils/jobs.js';

const WORK_COOLDOWN = 30 * 60 * 1000;
const LAPTOP_MULTIPLIER = 1.5;

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
        ),

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

        if (subcommand === 'select') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const shifts = userData.shifts || 0;
            const currentJobId = userData.job || 'janitor';
            const unlockedJobs = getUnlockedJobs(shifts);

            const embed = infoEmbed(
                "💼 Job Selection",
                `Select a job you'd like to work at. You currently have **${shifts}** total shifts.\n\n` +
                JOBS.map(j => {
                    const isUnlocked = shifts >= j.shiftsRequired;
                    const isCurrent = j.id === currentJobId;
                    return `${j.emoji} **${j.name}** ${isCurrent ? "*(Current)*" : ""}\n` +
                           `└ Pay: $${j.minPay}-$${j.maxPay} | ${isUnlocked ? "✅ Unlocked" : `🔒 Locked (${j.shiftsRequired} shifts required)`}`;
                }).join('\n\n')
            );

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('job_select')
                .setPlaceholder('Choose your job...')
                .addOptions(
                    JOBS.map(j => {
                        const isUnlocked = shifts >= j.shiftsRequired;
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





