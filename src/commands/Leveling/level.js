import { SlashCommandBuilder } from 'discord.js';
import { getUserLevelData, getLeaderboard, createLeaderboardEmbed } from '../../services/leveling.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Check your level or the leaderboard')
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Check a user\'s level')
                .addUserOption(option => 
                    option.setName('target')
                        .setDescription('The user to check')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('leaderboard')
                .setDescription('Show the top 15 users with the highest level')
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (subcommand === 'user') {
            await InteractionHelper.safeDefer(interaction);
            const target = interaction.options.getUser('target') || interaction.user;
            const userData = await getUserLevelData(client, guildId, target.id);
            
            await InteractionHelper.safeEditReply(interaction, {
                content: `${target.username} level is currently ${userData.level}`
            });
        }

        if (subcommand === 'leaderboard') {
            await InteractionHelper.safeDefer(interaction);
            const leaderboard = await getLeaderboard(client, guildId, 15);
            const embed = createLeaderboardEmbed(leaderboard, interaction.guild);
            
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed]
            });
        }
    }, { command: 'level' })
};
