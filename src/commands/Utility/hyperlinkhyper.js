import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';

const MODRINTH_API_BASE = 'https://api.modrinth.com/v2';
const CURSEFORGE_API_BASE = 'https://api.curseforge.com'; // Base URL for CurseForge API
const CURSEFORGE_API_KEY = process.env.CURSEFORGE_API_KEY; // Get API key from environment variables

const MODRINTH_USERNAME = 'hyperlinkhyper'; // Modrinth username
const CURSEFORGE_USERNAME = 'hyperlink_hyper'; // CurseForge username

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

            try {
                const headers = {
                    'x-api-key': CURSEFORGE_API_KEY,
                    'Accept': 'application/json'
                };

                // 1. Dynamically fetch user ID by username
                const userSearchResponse = await fetch(`${CURSEFORGE_API_BASE}/v1/users/search?username=${CURSEFORGE_USERNAME}`, { headers });
                if (!userSearchResponse.ok) {
                    if (userSearchResponse.status === 404) {
                        throw createError(
                            "CurseForge User Not Found",
                            ErrorTypes.EXTERNAL_API,
                            `CurseForge user \`${CURSEFORGE_USERNAME}\` not found.`,
                            { username: CURSEFORGE_USERNAME, statusCode: userSearchResponse.status }
                        );
                    }
                    throw createError(
                        "CurseForge API Error",
                        ErrorTypes.EXTERNAL_API,
                        `Failed to search for user \`${CURSEFORGE_USERNAME}\` on CurseForge API. Status: ${userSearchResponse.status}`,
                        { username: CURSEFORGE_USERNAME, statusCode: userSearchResponse.status, statusText: userSearchResponse.statusText }
                    );
                }
                const userSearchData = await userSearchResponse.json();
                if (!userSearchData.data || userSearchData.data.length === 0) {
                    throw createError(
                        "CurseForge User Not Found",
                        ErrorTypes.EXTERNAL_API,
                        `CurseForge user \`${CURSEFORGE_USERNAME}\` not found.`,
                        { username: CURSEFORGE_USERNAME }
                    );
                }
                const curseforgeUserId = userSearchData.data[0].id; // Get the numeric ID

                // 2. Fetch projects by the dynamically obtained user ID
                const projectsResponse = await fetch(`${CURSEFORGE_API_BASE}/v1/mods/search?gameId=432&userId=${curseforgeUserId}`, { headers });

                if (!projectsResponse.ok) {
                    throw createError(
                        "CurseForge API Error",
                        ErrorTypes.EXTERNAL_API,
                        `Failed to fetch projects for user \`${CURSEFORGE_USERNAME}\` (ID: ${curseforgeUserId}) from CurseForge API. Status: ${projectsResponse.status}`,
                        { username: CURSEFORGE_USERNAME, userId: curseforgeUserId, statusCode: projectsResponse.status, statusText: projectsResponse.statusText }
                    );
                }
                const projectsData = await projectsResponse.json();
                const projects = projectsData.data; // CurseForge API often wraps data in a 'data' field

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
                    .setURL(`https://www.curseforge.com/members/${CURSEFORGE_USERNAME}/projects`) // Link to user's projects page
                    .setThumbnail('https://www.curseforge.com/assets/images/logo-small.svg') // CurseForge logo
                    .setDescription(`Here are the statistics for CurseForge user **${CURSEFORGE_USERNAME}** (ID: \`${curseforgeUserId}\`).`)
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