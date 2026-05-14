import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, errorEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { parseDuration } from '../../services/giveawayService.js';
import PingService from '../../services/pingService.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('pinguser')
        .setDescription('Schedule or manage recurring role pings.')
        .setDefaultMemberPermissions(PermissionFlagsBits.MentionEveryone)
        .addSubcommand(subcommand =>
            subcommand
                .setName('schedule')
                .setDescription('Schedule a new recurring role ping.')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to ping.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('time')
                        .setDescription('The interval between pings (e.g., 3m, 2h, 4d).')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('The text to send with each ping.')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('command_to_reset')
                        .setDescription('A command (e.g., /work) that resets the ping timer when used.')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete an existing recurring role ping.')
                .addStringOption(option =>
                    option.setName('ping_id')
                        .setDescription('The ID of the ping to delete.')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),

    async autocomplete(interaction, client) { // Add client here
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'ping_id') {
            const pings = await PingService.getPingsForGuild(client, interaction.guildId); // Pass client
            const choices = pings
                .filter(ping => ping.id.startsWith(focusedOption.value))
                .map(ping => ({ name: `Ping ID: ${ping.id} | Role: <@&${ping.roleId}> | Interval: ${ping.intervalMs / (1000 * 60)}m`, value: ping.id }));

            await interaction.respond(choices.slice(0, 25));
        }
    },

    execute: withErrorHandling(async (interaction, config, client) => {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'schedule') {
            const role = interaction.options.getRole('role');
            const timeStr = interaction.options.getString('time');
            const text = interaction.options.getString('text');
            const commandToReset = interaction.options.getString('command_to_reset');

            try {
                const intervalMs = parseDuration(timeStr);
                const nextPingTime = Date.now() + intervalMs;

                await PingService.schedulePing(
                    client,
                    interaction.guildId,
                    interaction.channelId,
                    role.id,
                    intervalMs,
                    text,
                    commandToReset // Pass the new parameter
                );

                let description = `I will ping ${role.toString()} every **${timeStr}**.\nFirst ping in <t:${Math.floor(nextPingTime / 1000)}:R>.\n\n**Text:** ${text}`;
                if (commandToReset) {
                    description += `\n\nTimer will reset when command \`${commandToReset}\` is used.`;
                }

                const embed = successEmbed(
                    '✅ Recurring Ping Scheduled',
                    description
                );

                return await InteractionHelper.safeReply(interaction, { embeds: [embed] });
            } catch (error) {
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
                throw error;
            }
        } else if (subcommand === 'delete') {
            const pingId = interaction.options.getString('ping_id');

            try {
                const deleted = await PingService.deletePing(client, pingId, interaction.guildId);

                if (deleted) {
                    const embed = successEmbed(
                        '🗑️ Ping Deleted',
                        `Successfully deleted recurring ping with ID \`${pingId}\`.`
                    );
                    return await InteractionHelper.safeReply(interaction, { embeds: [embed] });
                } else {
                    const embed = errorEmbed(
                        '❌ Ping Not Found',
                        `Could not find a recurring ping with ID \`${pingId}\` in this server.`
                    );
                    return await InteractionHelper.safeReply(interaction, {
                        embeds: [embed],
                        flags: MessageFlags.Ephemeral
                    });
                }
            } catch (error) {
                logger.error(`Error deleting ping ${pingId}:`, error);
                const embed = errorEmbed(
                    '❌ Error Deleting Ping',
                    'An unexpected error occurred while trying to delete the ping.'
                );
                return await InteractionHelper.safeReply(interaction, { 
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral 
                });
            }
        }
    }, { command: 'pinguser' })
};
