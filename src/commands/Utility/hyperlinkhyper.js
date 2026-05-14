import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';

const MODRINTH_API_BASE = 'https://api.modrinth.com/v2';
const CURSEFORGE_API_BASE = 'https://api.curseforge.com'; // Base URL for CurseForge API
const CURSEFORGE_API_KEY = process.env.CURSEFORGE_API_KEY; // Get API key from environment variables

const MODRINTH_USERNAME = 'hyperlinkhyper'; // Modrinth username
const CURSEFORGE_USERNAME = 'hyperlink_hyper'; // CurseForge username

// You MUST manually find the numeric CurseForge User ID for 'hyperlink_hyper'
// and replace this placeholder.
// Example: If the URL is https://www.curseforge.com/members/12345678/projects, then the ID is '12345678'.
const CURSEFORGE_USER_ID = 'YOUR_NUMERIC_CURSEFORGE_USER_ID_HERE'; // <<< IMPORTANT: REPLACE THIS WITH THE ACTUAL NUMERIC USER ID

export default {
    data: new SlashCommandBuilder()
        .setName('hyperlinkhyper')
        .setDescription(`Commands related to the user hyperlinkhyper`)
        .addSubcommand(subcommand =>
            subcommand
                .setName('modrinth')
                .setDescription(`Displays Modrinth statistics for ${MODRINTH_USERNAME}`))
        .addSubcommand(subcommand =>
            subcommand
                .setName('curseforge')
                .setDescription(`Displays CurseForge statistics for ${CURSEFORGE_USERNAME}`)),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        await interaction.deferReply();

        if (subcommand === 'modrinth') {
            try {
                // 1. Fetch user details
                const userResponse = await fetch(`${MODRINTH_API_BASE}/user/${MODRINTH_USERNAME}`);
                if (!userResponse.ok) {
                    if (userResponse.status === 404) {
                        throw createError(
                            "Modrinth User Not Found",
                            ErrorTypes.EXTERNAL_API,
                            `Modrinth user \`${MODRINTH_USERNAME}\` not found.`,
                            { username: MODRINTH_USERNAME, statusCode: userResponse.status }
                        );
                    }
                    throw createError(
                        "Modrinth API Error",
                        ErrorTypes.EXTERNAL_API,
                        `Failed to fetch user \`${MODRINTH_USERNAME}\` from Modrinth API. Status: ${userResponse.status}`,
                        { username: MODRINTH_USERNAME, statusCode: userResponse.status, statusText: userResponse.statusText }
                    );
                }
                const userData = await userResponse.json();

                // 2. Fetch projects by user to get download counts and project types
                const projectsResponse = await fetch(`${MODRINTH_API_BASE}/user/${userData.id}/projects`);
                if (!projectsResponse.ok) {
                    throw createError(
                        "Modrinth API Error",
                        ErrorTypes.EXTERNAL_API,
                        `Failed to fetch projects for user \`${MODRINTH_USERNAME}\` from Modrinth API. Status: ${projectsResponse.status}`,
                        { username: MODRINTH_USERNAME, statusCode: projectsResponse.status, statusText: projectsResponse.statusText }
                    );
                }
                const projectsData = await projectsResponse.json();

                let totalDownloads = 0;
                let totalProjectFollowers = 0;
                const projectTypes = new Set();
                const projectCategories = new Set();

                for (const project of projectsData) {
                    totalDownloads += project.downloads;
                    totalProjectFollowers += project.followers;
                    projectTypes.add(project.project_type);
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
                        { name: 'Total Project Followers', value: (totalProjectFollowers ?? 0).toLocaleString(), inline: true },
                        { name: 'Project Types', value: projectTypes.size > 0 ? Array.from(projectTypes).map(type => type.charAt(0).toUpperCase() + type.slice(1)).join(', ') : 'N/A', inline: false },
                        { name: 'Loaders/Categories', value: projectCategories.size > 0 ? Array.from(projectCategories).map(cat => cat.charAt(0).toUpperCase() + cat.slice(1)).join(', ') : 'N/A', inline: false }
                    )
                    .setFooter({ text: `Requested by ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                logger.error(`[MODRINTH_USER_STATS] Error fetching stats for user ${MODRINTH_USERNAME}:`, error);
                if (error.type === ErrorTypes.EXTERNAL_API || error.type === ErrorTypes.VALIDATION) {
                    await interaction.editReply({ content: `❌ Error: ${error.message}`, ephemeral: true });
                } else {
                    await interaction.editReply({ content: '❌ An unexpected error occurred while fetching Modrinth user stats.', ephemeral: true });
                }
            }
        } else if (subcommand === 'curseforge') {
            if (!CURSEFORGE_API_KEY) {
                return interaction.editReply({ content: '❌ CurseForge API key is not configured. Please set `CURSEFORGE_API_KEY` in your environment variables.', ephemeral: true });
            }
            if (CURSEFORGE_USER_ID === 'YOUR_NUMERIC_CURSEFORGE_USER_ID_HERE') {
                return interaction.editReply({ content: `❌ CurseForge User ID for ${CURSEFORGE_USERNAME} is not configured. Please replace 'YOUR_NUMERIC_CURSEFORGE_USER_ID_HERE' in the command file with the actual numeric ID.`, ephemeral: true });
            }

            try {
                const headers = {
                    'x-api-key': CURSEFORGE_API_KEY,
                    'Accept': 'application/json'
                };

                // 1. Fetch projects by the manually provided numeric user ID
                const projectsResponse = await fetch(`${CURSEFORGE_API_BASE}/v1/mods/search?gameId=432&userId=${CURSEFORGE_USER_ID}`, { headers });

                if (!projectsResponse.ok) {
                    const errorBody = await projectsResponse.text();
                    logger.error(`[CURSEFORGE_USER_STATS] Project fetch failed for user ${CURSEFORGE_USERNAME} (ID: ${CURSEFORGE_USER_ID}). Status: ${projectsResponse.status}, Body: ${errorBody}`);
                    throw createError(
                        "CurseForge API Error",
                        ErrorTypes.EXTERNAL_API,
                        `Failed to fetch projects for user \`${CURSEFORGE_USERNAME}\` (ID: ${CURSEFORGE_USER_ID}) from CurseForge API. Status: ${projectsResponse.status}`,
                        { username: CURSEFORGE_USERNAME, userId: CURSEFORGE_USER_ID, statusCode: projectsResponse.status, statusText: projectsResponse.statusText, responseBody: errorBody }
                    );
                }
                const projectsData = await projectsResponse.json();
                const projects = projectsData.data;

                let totalDownloads = 0;
                let totalProjectFollowers = 0;
                const projectCategories = new Set();

                for (const project of projects) {
                    totalDownloads += project.downloadCount;
                    totalProjectFollowers += project.followerCount;
                    if (project.categories && project.categories.length > 0) {
                        const primaryCategory = project.categories.find(cat => cat.isPrimary) || project.categories[0];
                        if (primaryCategory && primaryCategory.name) {
                            projectCategories.add(primaryCategory.name);
                        }
                    }
                }

                const embed = new EmbedBuilder()
                    .setColor('#F16436') // CurseForge-like color
                    .setTitle(`📊 CurseForge Stats for ${CURSEFORGE_USERNAME}`)
                    .setURL(`https://www.curseforge.com/members/${CURSEFORGE_USERNAME}/projects`)
                    .setThumbnail('https://www.curseforge.com/assets/images/logo-small.svg')
                    .setDescription(`Here are the statistics for CurseForge user **${CURSEFORGE_USERNAME}** (ID: \`${CURSEFORGE_USER_ID}\`).`)
                    .addFields(
                        { name: 'Total Projects', value: projects.length.toString(), inline: true },
                        { name: 'Total Downloads', value: (totalDownloads ?? 0).toLocaleString(), inline: true },
                        { name: 'Total Project Followers', value: (totalProjectFollowers ?? 0).toLocaleString(), inline: true },
                        { name: 'Project Categories', value: projectCategories.size > 0 ? Array.from(projectCategories).join(', ') : 'N/A', inline: false }
                    )
                    .setFooter({ text: `Requested by ${interaction.user.tag}` })
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

            } catch (error) {
                logger.error(`[CURSEFORGE_USER_STATS] Error fetching stats for user ${CURSEFORGE_USERNAME}:`, error);
                if (error.type === ErrorTypes.EXTERNAL_API || error.type === ErrorTypes.VALIDATION) {
                    await interaction.editReply({ content: `❌ Error: ${error.message}`, ephemeral: true });
                } else {
                    await interaction.editReply({ content: '❌ An unexpected error occurred while fetching CurseForge user stats.', ephemeral: true });
                }
            }
        }
    },
};