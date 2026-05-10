import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { ACHIEVEMENTS, getAchievementStatus } from '../../config/achievements.js'; // Import achievement definitions
import { getEconomyData } from '../../utils/economy.js'; // Import function to get user economy data

export default {
    name: 'data_achievements',
    async execute(interaction, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, true); // Ephemeral reply
        if (!deferred) return;

        // More specific dev check (example - replace with actual dev IDs)
        const DEVELOPER_IDS = ['YOUR_DEV_ID_1', 'YOUR_DEV_ID_2']; // Replace with actual developer user IDs
        if (!DEVELOPER_IDS.includes(interaction.user.id) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            throw createError(
                "Insufficient permissions",
                ErrorTypes.VALIDATION,
                "This command is restricted to developers only."
            );
        }

        try {
            let achievementsData = '=== All Achievements Data ===\n\n';

            if (ACHIEVEMENTS.length === 0) {
                achievementsData += 'No achievements defined.\n';
            } else {
                achievementsData += '--- Achievement Definitions ---\n';
                ACHIEVEMENTS.forEach(ach => {
                    achievementsData += `ID: ${ach.id}, Name: ${ach.name}, Type: ${ach.type}, StatKey: ${ach.statKey}\n`;
                    achievementsData += `  Thresholds: ${ach.thresholds.map(t => `${t.level}: ${t.value}`).join(', ')}\n`;
                });
                achievementsData += '\n';

                achievementsData += '--- User Progress ---\n\n';

                // Iterate through all guilds the bot is in
                for (const [guildId, guild] of client.guilds.cache) {
                    achievementsData += `Guild: ${guild.name} (ID: ${guildId})\n`;
                    achievementsData += '--------------------------------------------------\n';

                    // Fetch all members for the guild (requires GUILD_MEMBERS intent)
                    const members = await guild.members.fetch().catch(e => {
                        logger.warn(`Could not fetch members for guild ${guild.name} (${guildId}): ${e.message}`);
                        return new Map(); // Return empty map if fetch fails
                    });

                    if (members.size === 0) {
                        achievementsData += '  No members found or could not fetch members.\n\n';
                        continue;
                    }

                    for (const [memberId, member] of members) {
                        const userData = await getEconomyData(client, guildId, memberId);

                        if (userData && (userData.stats || userData.shifts || userData.isBoosting)) { // Check if user has any relevant data
                            achievementsData += `  User: ${member.user.tag} (ID: ${memberId})\n`;
                            const userAchievementStatus = getAchievementStatus(userData);

                            userAchievementStatus.forEach(status => {
                                const currentLevel = status.currentLevel || 'None';
                                const nextThresholdInfo = status.nextThreshold ? ` (Next: ${status.nextThreshold.level} at ${status.nextThreshold.value})` : '';
                                achievementsData += `    - ${status.name} (${status.id}): Current: ${status.currentValue}, Level: ${currentLevel}${nextThresholdInfo}\n`;
                            });
                            achievementsData += '\n';
                        }
                    }
                    achievementsData += '\n';
                }
            }

            const fileBuffer = Buffer.from(achievementsData, 'utf-8');
            const attachment = new AttachmentBuilder(fileBuffer, { name: 'achievements_data.txt' });

            const embed = createEmbed({
                title: '🏆 Achievements Data',
                description: 'Here is the achievement data for all users.',
                color: '#00FF00' // Green for success
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed],
                files: [attachment],
                ephemeral: true
            });

        } catch (error) {
            logger.error('Error generating achievements data:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Error', 'An error occurred while generating achievements data.')],
                ephemeral: true
            });
        }
    },
};