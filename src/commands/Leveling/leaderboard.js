import { SlashCommandBuilder } from 'discord.js';
import { getLeaderboard, createLeaderboardEmbed } from '../../services/leveling.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View server leaderboards')
        .addSubcommand(subcommand =>
            subcommand
                .setName('level')
                .setDescription('View the top 15 users with the highest level')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('economy')
                .setDescription('View the server\'s top richest users')
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (subcommand === 'level') {
            await InteractionHelper.safeDefer(interaction);
            const leaderboard = await getLeaderboard(client, guildId, 15);
            const embed = createLeaderboardEmbed(leaderboard, interaction.guild);
            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        if (subcommand === 'economy') {
            await InteractionHelper.safeDefer(interaction);
            
            const prefix = `economy:${guildId}:`;
            let allKeys = await client.db.list(prefix);
            if (!Array.isArray(allKeys)) allKeys = [];

            if (allKeys.length === 0) {
                throw createError("No economy data found", ErrorTypes.VALIDATION, "No economy data found for this server.");
            }

            let allUserData = [];
            for (const key of allKeys) {
                const userId = key.replace(prefix, "");
                const userData = await client.db.get(key);
                if (userData) {
                    allUserData.push({
                        userId: userId,
                        net_worth: (userData.wallet || 0) + (userData.bank || 0),
                    });
                }
            }

            allUserData.sort((a, b) => b.net_worth - a.net_worth);
            const topUsers = allUserData.slice(0, 15);
            const userRank = allUserData.findIndex((u) => u.userId === interaction.user.id) + 1;
            const rankEmoji = ["🥇", "🥈", "🥉"];
            
            const leaderboardEntries = topUsers.map((user, i) => {
                const emoji = rankEmoji[i] || `**#${i + 1}**`;
                return `${emoji} <@${user.userId}> - 🏦 $${user.net_worth.toLocaleString()}`;
            });

            const embed = createEmbed({
                title: `Economy Leaderboard`,
                description: leaderboardEntries.length > 0 ? leaderboardEntries.join("\n") : "No data available.",
                footer: `Your Rank: ${userRank > 0 ? `#${userRank}` : "No ranking data available"}`,
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }
    }, { command: 'leaderboard' })
};
