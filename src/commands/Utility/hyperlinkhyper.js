import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';

const MODRINTH_API_BASE = 'https://api.modrinth.com/v2';
const TARGET_USERNAME = 'hyperlinkhyper'; // The specific user for this command

export default {
    data: new SlashCommandBuilder()
        .setName('hyperlinkhyper')
        .setDescription(`Commands related to the Modrinth user ${TARGET_USERNAME}`)
        .addSubcommand(subcommand =>
            subcommand
                .setName('modrinth')
                .setDescription(`Displays Modrinth statistics for ${TARGET_USERNAME}`)),

    async execute(interaction) {
        if (interaction.options.getSubcommand() !== 'modrinth') {
            return interaction.reply({ content: 'Invalid subcommand.', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            // 1. Fetch user details
            const userResponse = await fetch(`${MODRINTH_API_BASE}/user/${TARGET_USERNAME}`);
            if (!userResponse.ok) {
                if (userResponse.status === 404) {
                    throw createError(
                        "Modrinth User Not Found",
                        ErrorTypes.EXTERNAL_API,
                        `Modrinth user \`${TARGET_USERNAME}\` not found.`,
                        { username: TARGET_USERNAME, statusCode: userResponse.status }
                    );
                }
                throw createError(
                    "Modrinth API Error",
                    ErrorTypes.EXTERNAL_API,
                    `Failed to fetch user \`${TARGET_USERNAME}\` from Modrinth API. Status: ${userResponse.status}`,
                    { username: TARGET_USERNAME, statusCode: userResponse.status, statusText: userResponse.statusText }
                );
            }
            const userData = await userResponse.json();

            // 2. Fetch projects by user to get download counts and project types
            const projectsResponse = await fetch(`${MODRINTH_API_BASE}/user/${userData.id}/projects`);
            if (!projectsResponse.ok) {
                throw createError(
                    "Modrinth API Error",
                    ErrorTypes.EXTERNAL_API,
                    `Failed to fetch projects for user \`${TARGET_USERNAME}\` from Modrinth API. Status: ${projectsResponse.status}`,
                    { username: TARGET_USERNAME, statusCode: projectsResponse.status, statusText: projectsResponse.statusText }
                );
            }
            const projectsData = await projectsResponse.json();

            let totalDownloads = 0;
            let totalProjectFollowers = 0; // New variable to sum project followers
            const projectTypes = new Set();
            const projectCategories = new Set(); // e.g., 'fabric', 'forge', 'quilt'

            for (const project of projectsData) {
                totalDownloads += project.downloads;
                totalProjectFollowers += project.followers; // Summing followers from each project
                projectTypes.add(project.project_type); // e.g., 'mod', 'modpack, 'resourcepack'
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
                    { name: 'Total Downloads', value: (totalDownloads ?? 0).toLocaleString(), inline: true },
                    { name: 'Total Project Followers', value: (totalProjectFollowers ?? 0).toLocaleString(), inline: true }, // Displaying summed project followers
                    { name: 'Project Types', value: projectTypes.size > 0 ? Array.from(projectTypes).map(type => type.charAt(0).toUpperCase() + type.slice(1)).join(', ') : 'N/A', inline: false },
                    { name: 'Loaders/Categories', value: projectCategories.size > 0 ? Array.from(projectCategories).map(cat => cat.charAt(0).toUpperCase() + cat.slice(1)).join(', ') : 'N/A', inline: false }
                )
                .setFooter({ text: `Requested by ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            logger.error(`[MODRINTH_USER_STATS] Error fetching stats for user ${TARGET_USERNAME}:`, error);
            if (error.type === ErrorTypes.EXTERNAL_API || error.type === ErrorTypes.VALIDATION) {
                await interaction.editReply({ content: `❌ Error: ${error.message}`, ephemeral: true });
            } else {
                await interaction.editReply({ content: '❌ An unexpected error occurred while fetching Modrinth user stats.', ephemeral: true });
            }
        }
    },
};