import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getGuildConfig } from '../../utils/database.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('submit')
        .setDescription('Submit a new Truth or Dare question/task.')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of submission (Truth or Dare).')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option.setName('text')
                .setDescription('The content of your truth or dare.')
                .setRequired(true)
                .setMaxLength(1000)
        ),
    category: 'Fun',

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = ['truth', 'dare'];
        const filtered = choices.filter(choice => choice.startsWith(focusedValue));
        await interaction.respond(
            filtered.map(choice => ({ name: choice.charAt(0).toUpperCase() + choice.slice(1), value: choice }))
        ).catch(() => {});
    },

    execute: withErrorHandling(async (interaction, config, client) => {
        const type = interaction.options.getString('type').toLowerCase();
        const text = interaction.options.getString('text');
        const guildId = interaction.guildId;

        if (type !== 'truth' && type !== 'dare') {
            return await InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Invalid type. Please choose either "Truth" or "Dare".')],
                flags: MessageFlags.Ephemeral
            });
        }

        const guildConfig = await getGuildConfig(client, guildId);
        const submissionChannelId = guildConfig.truthOrDareSubmissionsChannelId;

        if (!submissionChannelId) {
            return await InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Submissions are not set up in this server. An admin needs to run `/setsubmit` first.')],
                flags: MessageFlags.Ephemeral
            });
        }

        const channel = await interaction.guild.channels.fetch(submissionChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            return await InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('The submission channel is missing or invalid. Please contact an admin.')],
                flags: MessageFlags.Ephemeral
            });
        }

        const submissionEmbed = infoEmbed(
            `**Type:** ${type.charAt(0).toUpperCase() + type.slice(1)}\n**Content:** ${text}`,
            '📝 New Truth or Dare Submission'
        )
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .setFooter({ text: `User ID: ${interaction.user.id}` })
        .setTimestamp();

        try {
            await channel.send({ embeds: [submissionEmbed] });
            
            const success = successEmbed(
                '✅ Submission Received',
                `Your **${type}** submission has been sent for review! Thank you for contributing.`
            );

            return await InteractionHelper.safeReply(interaction, {
                embeds: [success],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            logger.error('[SUBMIT] Failed to send submission to channel:', error);
            return await InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('Failed to send your submission. Please try again later.')],
                flags: MessageFlags.Ephemeral
            });
        }
    }, { command: 'submit' })
};
