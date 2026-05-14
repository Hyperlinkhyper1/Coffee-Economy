import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import { createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';

const MODRINTH_API_BASE = 'https://api.modrinth.com/v2';
const CURSEFORGE_API_BASE = 'https://api.curseforge.com'; // Base URL for CurseForge API

const MODRINTH_USERNAME = 'hyperlinkhyper'; // Modrinth username
const CURSEFORGE_USERNAME = 'hyperlink_hyper'; // CurseForge username
const CURSEFORGE_DISCOVERY_PROJECT = 'simply-cozy'; // Project slug to discover user ID

let cachedCurseForgeUserId = process.env.CURSEFORGE_USER_ID || '113515222';

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
            const apiKey = process.env.CURSEFORGE_API_KEY?.trim();
            
            if (!apiKey) {
                logger.error('[CURSEFORGE] API Key is missing from process.env.CURSEFORGE_API_KEY');
                return interaction.editReply({ content: '❌ CurseForge API key is not configured. Please set `CURSEFORGE_API_KEY` in your environment variables.', ephemeral: true });
            }

            // Log masked key for debugging on external server
            const maskedKey = apiKey.length > 8 
                ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` 
                : '*** (too short)';
            logger.info(`[CURSEFORGE] Using API Key: ${maskedKey} (Length: ${apiKey.length})`);

            try {
                const headers = {
                    'x-api-key': apiKey,
                    'Accept': 'application/json',
                    'User-Agent': 'TitanBot/2.0.0 (https://github.com/Touchpoint-Support)'
                };

                // Discover User ID if not cached
                let targetUserId = cachedCurseForgeUserId?.trim();
                
                if (!targetUserId || targetUserId === 'YOUR_NUMERIC_CURSEFORGE_USER_ID_HERE') {
                    logger.info(`[CURSEFORGE] Attempting to discover User ID for ${CURSEFORGE_USERNAME} via project ${CURSEFORGE_DISCOVERY_PROJECT}`);
                    
                    try {
                        const searchUrl = `${CURSEFORGE_API_BASE}/v1/mods/search?gameId=432&slug=${CURSEFORGE_DISCOVERY_PROJECT}`;
                        const searchResponse = await axios.get(searchUrl, { headers });
                        
                        if (searchResponse.data && searchResponse.data.data && searchResponse.data.data.length > 0) {
                            const project = searchResponse.data.data[0];
                            const author = project.authors.find(a => a.name.toLowerCase() === CURSEFORGE_USERNAME.toLowerCase());
                            if (author) {
                                targetUserId = author.id.toString();
                                cachedCurseForgeUserId = targetUserId; // Update cache
                                logger.info(`[CURSEFORGE] Discovered User ID for ${CURSEFORGE_USERNAME}: ${targetUserId}`);
                            }
                        }
                    } catch (error) {
                        logger.warn(`[CURSEFORGE] Discovery fetch failed: ${error.message}`);
                    }
                }

                if (!targetUserId) {
                    return interaction.editReply({ content: `❌ Could not automatically determine CurseForge User ID for ${CURSEFORGE_USERNAME}. Please ensure the discovery project slug is correct or set \`CURSEFORGE_USER_ID\` in your environment.`, ephemeral: true });
                }

                // 1. Fetch projects by the numeric user ID
                const modsUrl = `${CURSEFORGE_API_BASE}/v1/mods/search?gameId=432&userId=${targetUserId}`;
                logger.debug(`[CURSEFORGE] Fetching projects from: ${modsUrl}`);
                
                const projectsResponse = await axios.get(modsUrl, { headers });
                const projects = projectsResponse.data.data;

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
                    .setDescription(`Here are the statistics for CurseForge user **${CURSEFORGE_USERNAME}** (ID: \`${cachedCurseForgeUserId}\`).`)
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
                if (error.response) {
                    const status = error.response.status;
                    const data = JSON.stringify(error.response.data);
                    logger.error(`[CURSEFORGE_USER_STATS] API Error: Status ${status}, Body: ${data}`);
                    
                    if (status === 403) {
                        return interaction.editReply({ content: '❌ CurseForge API Error: Forbidden (403). Your API key might be invalid, expired, or restricted. Please check your `CURSEFORGE_API_KEY`.', ephemeral: true });
                    }
                    
                    await interaction.editReply({ content: `❌ CurseForge API Error: ${status} - ${error.message}`, ephemeral: true });
                } else {
                    logger.error(`[CURSEFORGE_USER_STATS] Error fetching stats for user ${CURSEFORGE_USERNAME}:`, error);
                    await interaction.editReply({ content: '❌ An unexpected error occurred while fetching CurseForge user stats.', ephemeral: true });
                }
            }
        }
    },
};