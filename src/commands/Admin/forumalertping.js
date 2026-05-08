import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { ForumAlertService } from '../../services/forumAlertService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('forumalertping')
        .setDescription('Add or remove a user from a forum alert ping list (Admin only)')
        .addStringOption(option =>
            option.setName('tag')
                .setDescription('The tag of the alert')
                .setAutocomplete(true)
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('user')
                .setDescription('The user to add/remove (type to search)')
                .setAutocomplete(true)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        
        if (focusedOption.name === 'tag') {
            const focusedValue = focusedOption.value.toLowerCase();
            const alerts = await ForumAlertService.getAlerts(interaction.client, interaction.guildId);
            const filtered = alerts
                .filter(a => a.tag.toLowerCase().includes(focusedValue))
                .map(a => ({ name: a.tag, value: a.tag }));
            await interaction.respond(filtered.slice(0, 25));
        } else if (focusedOption.name === 'user') {
            const focusedValue = focusedOption.value;
            if (!interaction.guild) return interaction.respond([]);

            try {
                const members = await interaction.guild.members.fetch({ query: focusedValue, limit: 25 });
                await interaction.respond(
                    members.map(member => ({
                        name: `${member.user.tag}${member.nickname ? ` (${member.nickname})` : ''}`,
                        value: member.id
                    }))
                );
            } catch (error) {
                await interaction.respond([]).catch(() => {});
            }
        }
    },

    execute: withErrorHandling(async (interaction, config, client) => {
        const tag = interaction.options.getString('tag');
        const userId = interaction.options.getString('user');
        const guildId = interaction.guildId;

        const result = await ForumAlertService.toggleUser(client, guildId, tag, userId);

        if (result.success) {
            const action = result.added ? 'added to' : 'removed from';
            await interaction.reply({
                embeds: [successEmbed(`User <@${userId}> has been **${action}** the ping list for alert **${tag}**.`, "🔔 Ping List Updated")]
            });
        } else {
            await interaction.reply({
                embeds: [errorEmbed(result.message || "Failed to update ping list.")],
                ephemeral: true
            });
        }
    }, { command: 'forumalertping' })
};
