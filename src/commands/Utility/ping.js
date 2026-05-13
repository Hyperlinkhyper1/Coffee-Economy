import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, errorEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { parseDuration } from '../../services/giveawayService.js';
import PingService from '../../services/pingService.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Schedule a role ping for later.')
        .setDefaultMemberPermissions(PermissionFlagsBits.MentionEveryone)
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to ping.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('time')
                .setDescription('The delay (e.g., 3m, 2h, 4d).')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The text to send with the ping.')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const role = interaction.options.getRole('role');
        const timeStr = interaction.options.getString('time');
        const text = interaction.options.getString('text');

        try {
            const delayMs = parseDuration(timeStr);
            const scheduledTime = Date.now() + delayMs;

            await PingService.schedulePing(
                client,
                interaction.guildId,
                interaction.channelId,
                role.id,
                delayMs,
                text
            );

            const embed = successEmbed(
                '✅ Ping Scheduled',
                `I will ping ${role.toString()} in <t:${Math.floor(scheduledTime / 1000)}:R>.\n\n**Text:** ${text}`
            );

            return await InteractionHelper.safeReply(interaction, { embeds: [embed] });
        } catch (error) {
            // Handle validation errors from parseDuration
            if (error.name === 'TitanBotError' || error.errorCode === 'VALIDATION_ERROR') {
                const embed = errorEmbed(
                    '❌ Invalid Duration',
                    error.message || 'Please use a valid format like `3m`, `2h`, or `1d`.'
                );
                return await InteractionHelper.safeReply(interaction, { 
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral 
                });
            }
            throw error; // Let withErrorHandling handle unexpected errors
        }
    }, { command: 'ping' })
};
