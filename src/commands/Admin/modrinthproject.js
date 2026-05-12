import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import ModrinthService from '../../services/modrinthService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('modrinthproject')
        .setDescription('Manage Modrinth project monitoring (Admin only)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a Modrinth project to monitor for updates')
                .addStringOption(option =>
                    option.setName('projectid')
                        .setDescription('The Modrinth project ID or slug')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a Modrinth project from monitoring')
                .addStringOption(option =>
                    option.setName('projectid')
                        .setDescription('The Modrinth project ID or slug')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all currently monitored Modrinth projects')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ping')
                .setDescription('Get the latest versions of Modrinth projects')
                .addStringOption(option =>
                    option.setName('projectids')
                        .setDescription('Comma-separated Modrinth project IDs or slugs (e.g., "sodium,lithium,phosphor")')
                        .setRequired(true)
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    execute: withErrorHandling(async (interaction, config, client) => {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const channelId = interaction.channelId;

        switch (subcommand) {
            case 'add': {
                const projectId = interaction.options.getString('projectid');

                try {
                    const monitorData = await ModrinthService.addProjectToMonitor(client, guildId, channelId, projectId);

                    await interaction.reply({
                        embeds: [successEmbed(
                            `✅ **${monitorData.projectName}** is now being monitored for updates!\n` +
                            `📦 **Project ID:** ${monitorData.projectId}\n` +
                            `🏷️ **Current Version:** ${monitorData.latestVersionNumber}\n` +
                            `📺 **Notifications:** This channel`,
                            "🔍 Modrinth Project Added"
                        )]
                    });
                } catch (error) {
                    await interaction.reply({
                        embeds: [errorEmbed(`Failed to add project: ${error.message}`)],
                        ephemeral: true
                    });
                }
                break;
            }

            case 'remove': {
                const projectId = interaction.options.getString('projectid');

                try {
                    await ModrinthService.removeProjectFromMonitor(client, guildId, projectId);

                    await interaction.reply({
                        embeds: [successEmbed(
                            `✅ **${projectId}** has been removed from monitoring.`,
                            "🔍 Modrinth Project Removed"
                        )]
                    });
                } catch (error) {
                    await interaction.reply({
                        embeds: [errorEmbed(`Failed to remove project: ${error.message}`)],
                        ephemeral: true
                    });
                }
                break;
            }

            case 'list': {
                try {
                    const monitoredProjects = await ModrinthService.getMonitoredProjects(client, guildId);

                    if (monitoredProjects.length === 0) {
                        await interaction.reply({
                            embeds: [successEmbed(
                                "No Modrinth projects are currently being monitored in this server.",
                                "🔍 Monitored Projects"
                            )]
                        });
                        return;
                    }

                    const projectList = monitoredProjects.map(project =>
                        `• **${project.projectName}** (${project.projectId})\n` +
                        `  📦 Version: ${project.latestVersionNumber}\n` +
                        `  📅 Last Checked: ${new Date(project.lastChecked).toLocaleString()}`
                    ).join('\n\n');

                    await interaction.reply({
                        embeds: [successEmbed(
                            `**Monitored Projects (${monitoredProjects.length}):**\n\n${projectList}`,
                            "🔍 Monitored Projects"
                        )]
                    });
                } catch (error) {
                    await interaction.reply({
                        embeds: [errorEmbed(`Failed to retrieve monitored projects: ${error.message}`)],
                        ephemeral: true
                    });
                }
                break;
            }

            case 'ping': {
                const projectIds = interaction.options.getString('projectids')
                    .split(',')
                    .map(id => id.trim())
                    .filter(id => id.length > 0);

                if (projectIds.length === 0) {
                    await interaction.reply({
                        embeds: [errorEmbed('Please provide at least one project ID.')],
                        ephemeral: true
                    });
                    return;
                }

                await interaction.deferReply();

                const results = [];
                const errors = [];

                for (const projectId of projectIds) {
                    try {
                        const project = await ModrinthService.fetchProject(projectId);
                        const versions = await ModrinthService.fetchProjectVersions(projectId);

                        if (versions && versions.length > 0) {
                            results.push({
                                project,
                                latestVersion: versions[0]
                            });
                        } else {
                            errors.push(`${projectId}: No versions found`);
                        }
                    } catch (error) {
                        errors.push(`${projectId}: ${error.message}`);
                    }
                }

                if (results.length === 0) {
                    await interaction.editReply({
                        embeds: [errorEmbed(
                            `Failed to fetch versions:\n${errors.join('\n')}`
                        )]
                    });
                    return;
                }

                const embeds = results.map(({ project, latestVersion }) => {
                    const primaryFile = latestVersion.files.find(f => f.primary) || latestVersion.files[0];
                    const fileSizeKB = primaryFile ? (primaryFile.size / 1024).toFixed(2) : 'N/A';
                    const releaseDate = new Date(latestVersion.date_published).toLocaleString();

                    return new EmbedBuilder()
                        .setColor('#36393F')
                        .setTitle(`📦 ${project.title}`)
                        .setURL(`https://modrinth.com/mod/${project.id}`)
                        .setThumbnail(project.icon_url)
                        .addFields(
                            { name: 'Version', value: latestVersion.version_number, inline: true },
                            { name: 'Release Type', value: latestVersion.version_type.charAt(0).toUpperCase() + latestVersion.version_type.slice(1), inline: true },
                            { name: 'Minecraft Versions', value: latestVersion.game_versions.join(', ') || 'N/A', inline: false },
                            { name: 'Loaders', value: latestVersion.loaders.join(', ') || 'N/A', inline: true },
                            { name: 'File Size', value: `${fileSizeKB} KB`, inline: true },
                            { name: 'Released On', value: releaseDate, inline: false },
                            { name: 'Download', value: `[Click Here](${primaryFile?.url || `https://modrinth.com/mod/${project.id}/version/${latestVersion.version_number}`})`, inline: false }
                        )
                        .setFooter({ text: `Project ID: ${project.id}` })
                        .setTimestamp();
                });

                const replyContent = errors.length > 0
                    ? `⚠️ **Partial Results** (${results.length}/${projectIds.length} successful):\n${errors.map(e => `• ${e}`).join('\n')}`
                    : `✅ **Latest Versions** (${results.length}/${projectIds.length}):`;

                await interaction.editReply({
                    content: replyContent,
                    embeds
                });
                break;
            }
        }
    }, { command: 'modrinthproject' })
};</content>
<parameter name="filePath">C:\Users\ayden\Downloads\Coffee-Economy\src\commands\Admin\modrinthproject.js
