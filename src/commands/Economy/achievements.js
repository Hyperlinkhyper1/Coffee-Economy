import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed, successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { getAchievementStatus, ACHIEVEMENTS } from '../../config/achievements.js';

export default {
    data: new SlashCommandBuilder()
        .setName('achievements')
        .setDescription('View or manage achievements')
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View your achievements or another user\'s achievements')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user you want to check achievements for')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('manage')
                .setDescription('Manage achievement progress for a user (Owner only)')
                .addStringOption(option =>
                    option.setName('achievement')
                        .setDescription('The achievement to manage')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Whether to progress or reset')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Progress (Level Up)', value: 'progress' },
                            { name: 'Reset', value: 'reset' }
                        )
                )
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to manage achievements for')
                        .setRequired(true)
                )
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const filtered = ACHIEVEMENTS.filter(a => a.name.toLowerCase().includes(focusedValue));
        await interaction.respond(
            filtered.slice(0, 25).map(a => ({ name: a.name, value: a.id }))
        ).catch(() => {});
    },

    execute: withErrorHandling(async (interaction, config, client) => {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (subcommand === 'view') {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            await InteractionHelper.safeDefer(interaction);

            const userData = await getEconomyData(client, guildId, targetUser.id);
            const achievements = getAchievementStatus(userData);

            const medalCounts = {
                'Bronze': 0,
                'Silver': 0,
                'Gold': 0,
                'Platinum': 0,
                'Diamond': 0,
                'Coffee Champion': 0
            };

            achievements.forEach(a => {
                if (a.currentLevel && medalCounts[a.currentLevel] !== undefined) {
                    medalCounts[a.currentLevel]++;
                }
            });

            const medalSummary = Object.entries(medalCounts)
                .filter(([_, count]) => count > 0)
                .map(([level, count]) => `**${level}:** ${count}`)
                .join(' • ');

            const embed = createEmbed({
                title: `🏆 ${targetUser.username}'s Achievements`,
                description: `Track your progress and unlock legendary ranks!\n\n${medalSummary ? `🏅 **Medals Earned:** ${medalSummary}\n\n` : ''}`,
                color: 'economy'
            }).setThumbnail(targetUser.displayAvatarURL());

            achievements.forEach(achievement => {
                const level = achievement.currentLevel || 'None';
                const value = achievement.currentValue;
                
                let progressText = '';
                if (achievement.type === 'boolean') {
                    progressText = value ? '✅ Completed' : '❌ Locked';
                } else {
                    const next = achievement.nextThreshold;
                    if (next) {
                        const progressBar = createProgressBar(value, next.value);
                        progressText = `${progressBar} (${value}/${next.value} to ${next.level})`;
                    } else {
                        progressText = '⭐⭐⭐ **MAX LEVEL REACHED** ⭐⭐⭐';
                    }
                }

                embed.addFields({
                    name: `${achievement.name} - ${level}`,
                    value: `${achievement.description}\n${progressText}`,
                    inline: false
                });
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } 
        
        else if (subcommand === 'manage') {
            // Check if user is owner
            if (interaction.user.id !== interaction.guild.ownerId) {
                throw createError("Unauthorized", ErrorTypes.PERMISSION, "Only the server owner can manage achievements.");
            }

            const achievementId = interaction.options.getString('achievement');
            const action = interaction.options.getString('action');
            const targetUser = interaction.options.getUser('user');

            await InteractionHelper.safeDefer(interaction);

            const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
            if (!achievement) {
                throw createError("Invalid Achievement", ErrorTypes.VALIDATION, "Achievement not found.");
            }

            const userData = await getEconomyData(client, guildId, targetUser.id);
            if (!userData.stats) {
                userData.stats = { messages: 0, reactions: 0, voiceMinutes: 0, isBoosting: false, fightsWon: 0 };
            }

            const statKey = achievement.statKey;
            const isStatInStats = userData.stats[statKey] !== undefined;

            if (action === 'reset') {
                if (isStatInStats) userData.stats[statKey] = achievement.type === 'boolean' ? false : 0;
                else userData[statKey] = 0;
                
                await setEconomyData(client, guildId, targetUser.id, userData);
                const embed = successEmbed(`Successfully reset **${achievement.name}** for **${targetUser.username}**.`);
                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            } 
            
            else if (action === 'progress') {
                const currentStatus = getAchievementStatus(userData).find(a => a.id === achievementId);
                
                if (achievement.type === 'boolean') {
                    userData.stats[statKey] = true;
                } else {
                    const next = currentStatus.nextThreshold;
                    if (!next) {
                        throw createError("Max Level", ErrorTypes.VALIDATION, "User has already reached the maximum level for this achievement.");
                    }
                    
                    if (isStatInStats) userData.stats[statKey] = next.value;
                    else userData[statKey] = next.value;
                }

                await setEconomyData(client, guildId, targetUser.id, userData);
                const embed = successEmbed(`Successfully progressed **${achievement.name}** for **${targetUser.username}**.`);
                await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }
        }

    }, { command: 'achievements' })
};

function createProgressBar(current, max, size = 10) {
    const progress = Math.min(Math.max(0, current / max), 1);
    const filledCount = Math.round(size * progress);
    const emptyCount = size - filledCount;
    
    const filled = '▰'.repeat(filledCount);
    const empty = '▱'.repeat(emptyCount);
    
    return `\`${filled}${empty}\` ${Math.round(progress * 100)}%`;
}
