import { logger } from '../utils/logger.js';
import { createError, ErrorTypes, TitanBotError } from '../utils/errorHandler.js';
import { EmbedBuilder, AttachmentBuilder } from 'discord.js'; // Import EmbedBuilder for notifications

const MODRINTH_API_BASE = 'https://api.modrinth.com/v2';
const MONITOR_INTERVAL_MINUTES = 10; // How often the cron job runs

class ModrinthService {
    /**
     * Fetches project details from Modrinth API.
     * @param {string} projectId - Modrinth project ID or slug.
     * @returns {object} Project details.
     */
    static async fetchProject(projectId) {
        try {
            const response = await fetch(`${MODRINTH_API_BASE}/project/${projectId}`);
            if (!response.ok) {
                if (response.status === 404) {
                    throw createError(
                        "Modrinth Project Not Found",
                        ErrorTypes.EXTERNAL_API,
                        `Modrinth project with ID/slug \`${projectId}\` not found.`,
                        { projectId, statusCode: response.status }
                    );
                }
                throw createError(
                    "Modrinth API Error",
                    ErrorTypes.EXTERNAL_API,
                    `Failed to fetch project \`${projectId}\` from Modrinth API. Status: ${response.status}`,
                    { projectId, statusCode: response.status, statusText: response.statusText }
                );
            }
            return await response.json();
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw createError(
                "Modrinth API Request Failed",
                ErrorTypes.EXTERNAL_API,
                `Could not connect to Modrinth API for project \`${projectId}\`.`,
                { projectId, originalError: error.message }
            );
        }
    }

    /**
     * Fetches latest version(s) for a project from Modrinth API.
     * @param {string} projectId - Modrinth project ID or slug.
     * @param {string[]} [loaders] - Optional array of loaders to filter by (e.g., ['fabric', 'forge']).
     * @param {string[]} [gameVersions] - Optional array of game versions to filter by (e.g., ['1.20.1']).
     * @returns {object[]} Array of version objects, sorted by date_published descending.
     */
    static async fetchProjectVersions(projectId, loaders = [], gameVersions = []) {
        try {
            const params = new URLSearchParams();
            if (loaders.length > 0) params.append('loaders', JSON.stringify(loaders));
            if (gameVersions.length > 0) params.append('game_versions', JSON.stringify(gameVersions));

            const response = await fetch(`${MODRINTH_API_BASE}/project/${projectId}/version?${params.toString()}`);
            if (!response.ok) {
                throw createError(
                    "Modrinth API Error",
                    ErrorTypes.EXTERNAL_API,
                    `Failed to fetch versions for project \`${projectId}\` from Modrinth API. Status: ${response.status}`,
                    { projectId, statusCode: response.status, statusText: response.statusText }
                );
            }
            const versions = await response.json();
            // Sort by date_published to ensure latest is first
            return versions.sort((a, b) => new Date(b.date_published) - new Date(a.date_published));
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw createError(
                "Modrinth API Request Failed",
                ErrorTypes.EXTERNAL_API,
                `Could not connect to Modrinth API for versions of project \`${projectId}\`.`,
                { projectId, originalError: error.message }
            );
        }
    }

    /**
     * Adds a Modrinth project to be monitored for updates.
     * @param {object} client - Discord client instance.
     * @param {string} guildId - Discord guild ID.
     * @param {string} channelId - Discord channel ID for notifications.
     * @param {string} projectId - Modrinth project ID or slug.
     * @returns {object} Monitored project data.
     */
    static async addProjectToMonitor(client, guildId, channelId, projectId) {
        const key = `modrinth:monitor:${guildId}:${projectId}`;
        const listKey = `modrinth:monitor:list:${guildId}`;

        try {
            const existing = await client.db.get(key);
            if (existing) {
                throw createError(
                    "Project Already Monitored",
                    ErrorTypes.VALIDATION,
                    `Modrinth project \`${projectId}\` is already being monitored in this server.`
                );
            }

            const projectDetails = await this.fetchProject(projectId);
            const latestVersions = await this.fetchProjectVersions(projectId);

            if (!latestVersions || latestVersions.length === 0) {
                throw createError(
                    "No Versions Found",
                    ErrorTypes.VALIDATION,
                    `Modrinth project \`${projectId}\` has no versions available to monitor.`
                );
            }

            const latestVersion = latestVersions[0];

            const monitorData = {
                projectId: projectDetails.id, // Store canonical ID
                projectSlug: projectDetails.slug,
                projectName: projectDetails.title,
                channelId: channelId,
                lastChecked: Date.now(),
                latestVersionId: latestVersion.id,
                latestVersionNumber: latestVersion.version_number,
                iconUrl: projectDetails.icon_url,
                dateAdded: Date.now()
            };

            await client.db.set(key, monitorData);

            const monitoredList = await client.db.get(listKey, []);
            if (!monitoredList.includes(projectDetails.id)) {
                monitoredList.push(projectDetails.id);
                await client.db.set(listKey, monitoredList);
            }

            logger.info(`[MODRINTH] Started monitoring project ${projectId} in guild ${guildId}, channel ${channelId}. Latest version: ${latestVersion.version_number}`);
            return monitorData;
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw createError(
                "Failed to Add Project",
                ErrorTypes.DATABASE,
                `An error occurred while adding project \`${projectId}\` for monitoring.`,
                { projectId, originalError: error.message }
            );
        }
    }

    /**
     * Removes a Modrinth project from monitoring.
     * @param {object} client - Discord client instance.
     * @param {string} guildId - Discord guild ID.
     * @param {string} projectId - Modrinth project ID or slug.
     * @returns {boolean} True if removed, false if not found.
     */
    static async removeProjectFromMonitor(client, guildId, projectId) {
        const key = `modrinth:monitor:${guildId}:${projectId}`;
        const listKey = `modrinth:monitor:list:${guildId}`;

        try {
            const existing = await client.db.get(key);
            if (!existing) {
                throw createError(
                    "Project Not Monitored",
                    ErrorTypes.VALIDATION,
                    `Modrinth project \`${projectId}\` is not currently being monitored in this server.`
                );
            }

            await client.db.delete(key);

            let monitoredList = await client.db.get(listKey, []);
            monitoredList = monitoredList.filter(id => id !== existing.projectId); // Filter by canonical ID
            await client.db.set(listKey, monitoredList);

            logger.info(`[MODRINTH] Stopped monitoring project ${projectId} in guild ${guildId}.`);
            return true;
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw createError(
                "Failed to Remove Project",
                ErrorTypes.DATABASE,
                `An error occurred while removing project \`${projectId}\` from monitoring.`,
                { projectId, originalError: error.message }
            );
        }
    }

    /**
     * Gets all projects monitored in a specific guild.
     * @param {object} client - Discord client instance.
     * @param {string} guildId - Discord guild ID.
     * @returns {object[]} Array of monitored project data.
     */
    static async getMonitoredProjects(client, guildId) {
        const listKey = `modrinth:monitor:list:${guildId}`;
        try {
            const monitoredList = await client.db.get(listKey, []);
            const projects = [];
            for (const projectId of monitoredList) {
                const key = `modrinth:monitor:${guildId}:${projectId}`;
                const projectData = await client.db.get(key);
                if (projectData) {
                    projects.push(projectData);
                } else {
                    // Clean up orphaned entry in list if data is missing
                    logger.warn(`[MODRINTH] Orphaned project ID ${projectId} found in list for guild ${guildId}. Cleaning up.`);
                    monitoredList = monitoredList.filter(id => id !== projectId);
                    await client.db.set(listKey, monitoredList);
                }
            }
            return projects;
        } catch (error) {
            throw createError(
                "Failed to Get Monitored Projects",
                ErrorTypes.DATABASE,
                `An error occurred while retrieving monitored projects for guild \`${guildId}\`.`,
                { guildId, originalError: error.message }
            );
        }
    }

    /**
     * Gets all projects monitored across all guilds.
     * This is primarily for the cron job.
     * @param {object} client - Discord client instance.
     * @returns {object[]} Array of all monitored project data.
     */
    static async getAllMonitoredProjects(client) {
        // Assuming client.db.listKeys can handle wildcards or we need to iterate guilds
        // For now, let's assume a direct key lookup is possible if we store a global list,
        // or we iterate through all guilds the bot is in.
        // Given the current key structure `modrinth:monitor:guildId:projectId`,
        // we'll need to iterate through guilds to get their lists.
        const allMonitoredProjects = [];
        const guildIds = client.guilds.cache.map(guild => guild.id); // Get all guild IDs the bot is in

        for (const guildId of guildIds) {
            try {
                const projectsInGuild = await this.getMonitoredProjects(client, guildId);
                allMonitoredProjects.push(...projectsInGuild);
            } catch (error) {
                logger.error(`[MODRINTH] Error getting monitored projects for guild ${guildId} during global fetch:`, error);
            }
        }
        return allMonitoredProjects;
    }


    /**
     * Checks for updates for a specific project and sends a notification if a new version is found.
     * @param {object} client - Discord client instance.
     * @param {object} monitoredProject - The project data from the database.
     */
    static async checkAndUpdateProject(client, monitoredProject) {
        const { projectId, channelId, latestVersionNumber, projectName, iconUrl, guildId } = monitoredProject;
        const key = `modrinth:monitor:${guildId}:${projectId}`;

        try {
            const latestVersions = await this.fetchProjectVersions(projectId);
            if (!latestVersions || latestVersions.length === 0) {
                logger.warn(`[MODRINTH] No versions found for project ${projectId} during update check.`);
                return;
            }

            const newLatestVersion = latestVersions[0];

            if (newLatestVersion.version_number !== latestVersionNumber) {
                logger.info(`[MODRINTH] New version detected for ${projectName} (${projectId}): ${newLatestVersion.version_number}`);

                // Update stored latest version in DB
                monitoredProject.latestVersionId = newLatestVersion.id;
                monitoredProject.latestVersionNumber = newLatestVersion.version_number;
                monitoredProject.lastChecked = Date.now();
                await client.db.set(key, monitoredProject);

                // Send notification
                const channel = await client.channels.fetch(channelId);
                if (channel && channel.isTextBased()) {
                    // Fetch full version details to get changelog
                    let fullVersionDetails = newLatestVersion;
                    try {
                        fullVersionDetails = await this.fetchVersionDetails(newLatestVersion.id);
                    } catch (error) {
                        logger.warn(`[MODRINTH] Could not fetch full version details for ${newLatestVersion.id}, using basic version data`);
                    }

                    const embed = this.createUpdateEmbed(projectName, iconUrl, fullVersionDetails);
                    await channel.send({ embeds: [embed] });
                    logger.info(`[MODRINTH] Sent update notification for ${projectName} to channel ${channelId}.`);
                } else {
                    logger.warn(`[MODRINTH] Notification channel ${channelId} for project ${projectName} not found or not text-based.`);
                }
            } else {
                logger.debug(`[MODRINTH] No new version for ${projectName} (${projectId}). Current: ${latestVersionNumber}`);
                // Update last checked timestamp even if no new version
                monitoredProject.lastChecked = Date.now();
                await client.db.set(key, monitoredProject);
            }
        } catch (error) {
            logger.error(`[MODRINTH] Error checking/updating project ${projectId}:`, error);
            // Optionally send an error notification to the channel or a dev channel
        }
    }

    /**
     * Creates a Discord embed for a Modrinth project update notification.
     * @param {string} projectName
     * @param {string} iconUrl
     * @param {object} version - The new version object from Modrinth API.
     * @returns {EmbedBuilder}
     */
    static createUpdateEmbed(projectName, iconUrl, version) {
        const primaryFile = version.files.find(f => f.primary) || version.files[0]; // Get primary file or first file
        const fileSizeKB = primaryFile ? (primaryFile.size / 1024).toFixed(2) : 'N/A';
        const releaseDate = new Date(version.date_published).toLocaleString();
        const versionLink = `https://modrinth.com/mod/${version.project_id}/version/${version.version_number}`; // Construct version link

        const embed = new EmbedBuilder()
            .setColor('#36393F') // Modrinth-like color
            .setTitle(`⬆️ ${projectName} Updated!`)
            .setURL(`https://modrinth.com/mod/${version.project_id}`) // Link to project page
            .setThumbnail(iconUrl)
            .setDescription(`A new version of **${projectName}** has been released!`)
            .addFields(
                { name: 'Version', value: version.version_number, inline: true },
                { name: 'Release Type', value: version.version_type.charAt(0).toUpperCase() + version.version_type.slice(1), inline: true },
                { name: 'Minecraft Versions', value: version.game_versions.join(', ') || 'N/A', inline: false },
                { name: 'Loaders', value: version.loaders.join(', ') || 'N/A', inline: true },
                { name: 'File Size', value: `${fileSizeKB} KB` || 'N/A', inline: true },
                { name: 'Released On', value: releaseDate, inline: false },
                { name: 'Download', value: `[Click Here](${versionLink})`, inline: false } // Added link to version
            )
            .setFooter({ text: `Modrinth Project ID: ${version.project_id}` })
            .setTimestamp();

        // Store changelog in embed data for button access
        embed.data.changelog = version.body || 'No changelog provided';
        embed.data.projectId = version.project_id;
        embed.data.versionNumber = version.version_number;

        return embed;
    }
}

export default ModrinthService;