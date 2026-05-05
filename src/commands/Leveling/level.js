import { SlashCommandBuilder } from 'discord.js';
import { getUserLevelData, getLeaderboard, createLeaderboardEmbed } from '../../services/leveling.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Check your level or another user\'s level')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to check')
                .setRequired(false)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        await InteractionHelper.safeDefer(interaction);
        
        const targetUser = interaction.options.getUser('target') || interaction.user;
        const guildId = interaction.guildId;
        
        const userData = await getUserLevelData(client, guildId, targetUser.id);
        
        await InteractionHelper.safeEditReply(interaction, {
            content: `${targetUser.username} level is currently ${userData.level}`
        });
    }, { command: 'level' })
};


