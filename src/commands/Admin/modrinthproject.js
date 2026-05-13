import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed } from '../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import ModrinthService from '../../services/modrinthService.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('modrinthproject')
        .setDescription('Manage Modrinth projects to monitor for updates.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a Modrinth project to monitor for updates.')
                .addStringOption(option =>
                    option.setName('projectid')
                        .setDescription('The Modrinth project ID or slug (e.g., "sodium" or "AANobbMI").')
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to send update notifications to.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a Modrinth project from monitoring.')
                .addStringOption(option =>
                    option.setName('projectid')
                        .setDescription('The Modrinth project ID or slug to stop monitoring.')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all Modrinth projects currently being monitored in this server.')
        ),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const guildId = interaction.guildId;
        const client = interaction.client;

        if (focusedOption.name === 'projectid') {
            try {
                const monitoredProjects = await ModrinthService.getMonitoredProjects(client, guildId);
                const choices = monitoredProjects.map(p => ({
                    name: `${p.projectName} (${p.projectSlug})`,
                    value: p.projectId // Use canonical ID for removal
                }));

                const filtered = choices.filter(choice =>
                    choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
                );

                await interaction.respond(filtered.slice(0, 25));
            } catch (error) {
                logger.warn('[MODRINTH] Autocomplete error:', error);
                await interaction.respond([]).catch(() => {});
            }
        }
    },

    execute: withErrorHandling(async (interaction, config, client) => {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        if (subcommand === 'add') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const projectId = interaction.options.getString('projectid');
            const channel = interaction.options.getChannel('channel');

            const monitorData = await ModrinthService.addProjectToMonitor(client, guildId, channel.id, projectId);

            const embed = successEmbed(
                '✅ Modrinth Project Added',
                `Now monitoring **${monitorData.projectName}** for updates. Notifications will be sent to ${channel.toString()}.`
            );

            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        if (subcommand === 'remove') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const projectId = interaction.options.getString('projectid');

            await ModrinthService.removeProjectFromMonitor(client, guildId, projectId);

            const embed = successEmbed(
                '🗑️ Modrinth Project Removed',
                `Stopped monitoring project \`${projectId}\`.`
            );

            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        if (subcommand === 'list') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const monitoredProjects = await ModrinthService.getMonitoredProjects(client, guildId);

            if (monitoredProjects.length === 0) {
                const embed = infoEmbed(
                    '📋 Monitored Modrinth Projects',
                    'No Modrinth projects are currently being monitored in this server.'
                );
                return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }

            const description = monitoredProjects.map(p =>
                `**${p.projectName}** (\`${p.projectSlug}\`)\n` +
                `  ID: \`${p.projectId}\`\n` +
                `  Channel: <#${p.channelId}>\n` +
                `  Latest Version: \`${p.latestVersionNumber}\`\n` +
                `  Last Checked: <t:${Math.floor(p.lastChecked / 1000)}:R>`
            ).join('\n\n');

            const embed = createEmbed({
                title: '📋 Monitored Modrinth Projects',
                description: description,
                color: '#36393F'
            });

            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }
    }, { command: 'modrinthproject' })
};