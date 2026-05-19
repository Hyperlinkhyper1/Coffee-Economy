import { SlashCommandBuilder, ChannelType, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { forumAlertService } from '../../services/forumAlertService.js'; // Import the service

export default {
    data: new SlashCommandBuilder()
        .setName('close')
        .setDescription('Closes a forum post, marking it as fixed or normal.')
        .addStringOption(option =>
            option.setName('status')
                .setDescription('The status to mark the post with (fixed or normal).')
                .setRequired(true)
                .addChoices(
                    { name: 'Fixed', value: 'fixed' },
                    { name: 'Normal', value: 'normal' },
                ))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('The reason for closing the post.')
                .setRequired(true)),
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const { channel, options, guild } = interaction;
        const status = options.getString('status');
        const reason = options.getString('reason');

        if (channel.type !== ChannelType.PublicThread && channel.type !== ChannelType.PrivateThread) {
            return interaction.reply({
                content: 'This command can only be used within a forum post (thread).',
                ephemeral: true,
            });
        }

        try {
            const newPrefix = status === 'fixed' ? '[Fixed]' : '[Normal]';
            const currentName = channel.name;

            // Remove existing [Fixed] or [Normal] prefixes if they exist
            const cleanedName = currentName.replace(/^\[(Fixed|Normal)\]\s*/i, '');
            const newName = `${newPrefix} ${cleanedName}`;

            await channel.setName(newName, `Closed by ${interaction.user.tag} - ${reason}`);
            await channel.setLocked(true, `Closed by ${interaction.user.tag} - ${reason}`);

            // Disable forumalert pings for this thread
            await forumAlertService.disableAlertsForChannel(channel.id);
            logger.info(`Forum post "${currentName}" (${channel.id}) closed by ${interaction.user.tag} with status "${status}". Reason: ${reason}. Forum alerts disabled.`);

            const embed = new EmbedBuilder()
                .setColor(status === 'fixed' ? '#00FF00' : '#FFFF00') // Green for fixed, Yellow for normal
                .setTitle(`Forum Post Closed: ${newPrefix}`)
                .setDescription(`This post has been marked as **${status}** and locked.`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Closed By', value: interaction.user.tag }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            logger.error(`Failed to close forum post ${channel.id}:`, error);
            await interaction.reply({
                content: 'There was an error trying to close this forum post.',
                ephemeral: true,
            });
        }
    },
};