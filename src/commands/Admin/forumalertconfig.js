import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { ForumAlertService } from '../../services/forumAlertService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('forumalertconfig')
        .setDescription('Configure the interval of a forum alert (Admin only)')
        .addStringOption(option =>
            option.setName('tag')
                .setDescription('The tag of the alert to configure')
                .setAutocomplete(true)
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('interval')
                .setDescription('Interval (e.g., 12h, 1d)')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const alerts = await ForumAlertService.getAlerts(interaction.client, interaction.guildId);
        const filtered = alerts
            .filter(a => a.tag.toLowerCase().includes(focusedValue))
            .map(a => ({ name: a.tag, value: a.tag }));
        await interaction.respond(filtered.slice(0, 25));
    },

    execute: withErrorHandling(async (interaction, config, client) => {
        const tag = interaction.options.getString('tag');
        const interval = interaction.options.getString('interval');
        const guildId = interaction.guildId;

        const success = await ForumAlertService.updateConfig(client, guildId, tag, interval);

        if (success) {
            await interaction.reply({
                embeds: [successEmbed(`Interval for alert **${tag}** updated to **${interval}**.`, "⚙️ Config Updated")]
            });
        } else {
            await interaction.reply({
                embeds: [errorEmbed(`Failed to update config. Ensure the tag exists and the interval format is correct (e.g., 12h, 1d).`)],
                ephemeral: true
            });
        }
    }, { command: 'forumalertconfig' })
};
