import { SlashCommandBuilder } from 'discord.js';
import { getUserLevelData, addLevels } from '../../services/leveling.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed } from '../../utils/embeds.js';

export default {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Manage or check levels')
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Check your level or another user\'s level')
                .addUserOption(option => 
                    option.setName('target')
                        .setDescription('The user to check')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add levels to a user (Server Owner Only)')
                .addUserOption(option => 
                    option.setName('target')
                        .setDescription('The user to give levels to')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('The number of levels to add')
                        .setRequired(true)
                        .setMinValue(1)
                )
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (subcommand === 'info') {
            await InteractionHelper.safeDefer(interaction);
            const targetUser = interaction.options.getUser('target') || interaction.user;
            const userData = await getUserLevelData(client, guildId, targetUser.id);
            
            await InteractionHelper.safeEditReply(interaction, {
                content: `${targetUser.username} level is currently ${userData.level}`
            });
        }

        if (subcommand === 'add') {
            // Check if user is server owner
            if (interaction.user.id !== interaction.guild.ownerId) {
                throw createError(
                    "Insufficient Permissions",
                    ErrorTypes.PERMISSION,
                    "Only the server owner can use this command."
                );
            }

            await InteractionHelper.safeDefer(interaction);
            const targetUser = interaction.options.getUser('target');
            const amount = interaction.options.getInteger('amount');

            await addLevels(client, guildId, targetUser.id, amount);

            const embed = successEmbed(
                `Successfully added **${amount}** levels to **${targetUser.username}**.`,
                "Levels Added"
            );

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed]
            });
        }
    }, { command: 'level' })
};
