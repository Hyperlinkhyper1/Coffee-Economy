import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { ForumAlertService } from '../../services/forumAlertService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setforumalert')
        .setDescription('Set a forum alert for a channel (Admin only)')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send alerts in')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum)
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('tag')
                .setDescription('A unique tag for this alert')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    execute: withErrorHandling(async (interaction, config, client) => {
        const channel = interaction.options.getChannel('channel');
        const tag = interaction.options.getString('tag');
        const guildId = interaction.guildId;

        await ForumAlertService.addAlert(client, guildId, channel.id, tag);

        await interaction.reply({
            embeds: [successEmbed(`Forum alert set for channel ${channel} with tag **${tag}**.`, "🔔 Alert Set")]
        });
    }, { command: 'setforumalert' })
};
