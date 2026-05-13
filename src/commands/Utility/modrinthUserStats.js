import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';

const MODRINTH_API_BASE = 'https://api.modrinth.com/v2';

export default {
    data: new SlashCommandBuilder()
        .setName('modrinthuserstats')
        .setDescription('Displays statistics for a Modrinth user.')
        .addStringOption(option =>
            option.setName('username')
                .setDescription('The Modrinth username to get stats for (e.g., hyperlinkhyper)')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();

        const username = interaction.options.getString('username');

        try {
            // 1. Fetch user details
            const userResponse = await fetch(`${MODRINTH_API_BASE}/user/${username}`);
            if (!userResponse.ok) {
                if (userResponse.status === 404) {
                    throw createError(
                        "Modrinth User Not Found",
                        ErrorTypes.EXTERNAL_API,
                        `Modrinth user \`${username}\` not found.`,
                        { username, statusCode: userResponse.status }
                    );
                }
                throw createError(
                    "Modrinth API Error",
                    ErrorTypes.EXTERNAL_API,
                    `Failed to fetch user \`${username}\` from Modrinth API. Status: ${userResponse.status}`,
                    { username, statusCode: userResponse.status, statusText: userResponse.statusText }
                );
            }
            const userData = await userResponse.json();

            // 2. Fetch projects by user to get download counts and project types
            // Modrinth API doesn't provide total downloads for a user directly,
            // so we need to sum downloads from all their projects.
            const projectsResponse = await fetch(`${MODRINTH_API_BASE}/user/${userData.id}/projects`);
            if (!projectsResponse.ok) {
                throw createError(
                    "Modrinth API Error",
                    ErrorTypes.EXTERNAL_API,
                    `Failed to fetch projects for user \`${username}\` from Modrinth API. Status: ${projectsResponse.status}`,
                    { username, statusCode: projectsResponse.status, statusText: projectsResponse.statusText }
                );
            }
            const projectsData = await projectsResponse.json();

            let totalDownloads = 0;
            const projectTypes = new Set();
            const projectCategories = new Set(); // e.g., 'fabric', 'forge', 'quilt'

            for (const project of projectsData) {
                totalDownloads += project.downloads;
                projectTypes.add(project.project_type); // e.g., 'mod', 'modpack', 'resourcepack'
                if (project.loaders && Array.isArray(project.loaders)) {
                    project.loaders.forEach(loader => projectCategories.add(loader));
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#36393F') // Modrinth-like color
                .setTitle(`📊 Modrinth Stats for ${userData.username}`)
                .setURL(`https://modrinth.com/user/${userData.username}`)
                .setThumbnail(userData.avatar_url || null)
                .setDescription(`Here are the statistics for Modrinth user **${userData.username}** (ID: \`${userData.id}\`).`)
                .addFields(
                    { name: 'Total Projects', value: projectsData.length.toString(), inline: true },
                    { name: 'Total Downloads', value: totalDownloads.toLocaleString(), inline: true },
                    { name: 'Followers', value: userData.followers.toLocaleString(), inline: true },
                    { name: 'Project Types', value: projectTypes.size > 0 ? Array.from(projectTypes).map(type => type.charAt(0).toUpperCase() + type.slice(1)).join(', ') : 'N/A', inline: false },
                    { name: 'Loaders/Categories', value: projectCategories.size > 0 ? Array.from(projectCategories).map(cat => cat.charAt(0).toUpperCase() + cat.slice(1)).join(', ') : 'N/A', inline: false }
                )
                .setFooter({ text: `Requested by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`[MODRINTH_USER_STATS] Error fetching stats for user ${username}:`, error);
            if (error.type === ErrorTypes.EXTERNAL_API || error.type === ErrorTypes.VALIDATION) {
                await interaction.editReply({ content: `❌ Error: ${error.message}`, ephemeral: true });
            } else {
                await interaction.editReply({ content: '❌ An unexpected error occurred while fetching Modrinth user stats.', ephemeral: true });
            }
        }
    },
};
