import { logger } from '../utils/logger.js';
import { createError, ErrorTypes } from '../utils/errorHandler.js';

class PingService {
    /**
     * Schedules a ping for a role.
     * @param {object} client - Discord client.
     * @param {string} guildId - Guild ID.
     * @param {string} channelId - Channel ID.
     * @param {string} roleId - Role ID to ping.
     * @param {number} delayMs - Delay in milliseconds.
     * @param {string} text - Message text.
     * @param {string} [commandToReset] - Optional command that resets the ping timer.
     */
    static async schedulePing(client, guildId, channelId, roleId, intervalMs, text, commandToReset) {
        const scheduledTime = Date.now() + intervalMs;
        const pingId = `ping:${guildId}:${Date.now()}:${Math.floor(Math.random() * 1000)}`;
        
        const pingData = {
            id: pingId,
            guildId,
            channelId,
            roleId,
            scheduledTime,
            intervalMs,
            text,
            createdAt: Date.now(),
            commandToReset: commandToReset ? commandToReset.toLowerCase() : null // Store the command to reset in lowercase
        };

        try {
            await client.db.set(pingId, pingData);
            
            // Add to a global list of pending pings
            const pendingPings = await client.db.get('pings:pending', []);
            pendingPings.push(pingId);
            await client.db.set('pings:pending', pendingPings);

            // Also set a timeout for the current process
            this.setPingTimeout(client, pingData);

            logger.info(`[PING] Scheduled ping for role ${roleId} in guild ${guildId} at ${new Date(scheduledTime).toISOString()}`);
            return pingData;
        } catch (error) {
            logger.error('[PING] Failed to schedule ping:', error);
            throw createError('Failed to schedule ping', ErrorTypes.DATABASE, error.message);
        }
    }

    /**
     * Deletes a scheduled ping.
     * @param {object} client - Discord client.
     * @param {string} pingId - The ID of the ping to delete.
     * @param {string} guildId - The guild ID the ping belongs to.
     * @returns {boolean} - True if deleted, false otherwise.
     */
    static async deletePing(client, pingId, guildId) {
        try {
            const pingData = await client.db.get(pingId);
            if (pingData && pingData.guildId === guildId) {
                await client.db.delete(pingId);
                const pendingPings = await client.db.get('pings:pending', []);
                const updatedPings = pendingPings.filter(id => id !== pingId);
                await client.db.set('pings:pending', updatedPings);
                logger.info(`[PING] Deleted ping ${pingId} from guild ${guildId}`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`[PING] Error deleting ping ${pingId}:`, error);
            return false;
        }
    }

    /**
     * Deletes all pings for a specific guild.
     * @param {object} client - Discord client.
     * @param {string} guildId - The guild ID.
     * @returns {Promise<number>} - The number of pings deleted.
     */
    static async deleteAllPings(client, guildId) {
        try {
            const allPingIds = await client.db.get('pings:pending', []);
            let deleteCount = 0;
            const remainingPingIds = [];

            for (const pingId of allPingIds) {
                const pingData = await client.db.get(pingId);
                if (pingData && pingData.guildId === guildId) {
                    await client.db.delete(pingId);
                    deleteCount++;
                    logger.info(`[PING] Deleted ping ${pingId} during mass deletion for guild ${guildId}`);
                } else {
                    remainingPingIds.push(pingId);
                }
            }

            if (deleteCount > 0) {
                await client.db.set('pings:pending', remainingPingIds);
            }

            logger.info(`[PING] Deleted ${deleteCount} pings for guild ${guildId}`);
            return deleteCount;
        } catch (error) {
            logger.error(`[PING] Error deleting all pings for guild ${guildId}:`, error);
            throw error;
        }
    }

    /**
     * Retrieves all pings for a specific guild.
     * @param {object} client - Discord client.
     * @param {string} guildId - The ID of the guild.
     * @returns {Array<object>} - An array of ping data objects.
     */
    static async getPingsForGuild(client, guildId) {
        try {
            const allPingIds = await client.db.get('pings:pending', []);
            const guildPings = [];
            for (const pingId of allPingIds) {
                const pingData = await client.db.get(pingId);
                if (pingData && pingData.guildId === guildId) {
                    guildPings.push(pingData);
                }
            }
            return guildPings;
        } catch (error) {
            logger.error(`[PING] Error getting pings for guild ${guildId}:`, error);
            return [];
        }
    }

    /**
     * Sets a timeout to execute a ping.
     * @param {object} client 
     * @param {object} pingData 
     */
    static setPingTimeout(client, pingData) {
        const now = Date.now();
        const delay = Math.max(0, pingData.scheduledTime - now);

        // Clear any existing timeout for this ping to prevent duplicates
        if (client.pingTimeouts && client.pingTimeouts.has(pingData.id)) {
            clearTimeout(client.pingTimeouts.get(pingData.id));
            client.pingTimeouts.delete(pingData.id);
        }

        const timeout = setTimeout(async () => {
            try {
                await this.executePing(client, pingData);
            } catch (error) {
                logger.error(`[PING] Error in ping timeout for ${pingData.id}:`, error);
            } finally {
                if (client.pingTimeouts) {
                    client.pingTimeouts.delete(pingData.id);
                }
            }
        }, delay);

        if (!client.pingTimeouts) {
            client.pingTimeouts = new Map();
        }
        client.pingTimeouts.set(pingData.id, timeout);
    }

    /**
     * Executes a scheduled ping.
     * @param {object} client 
     * @param {object} pingData 
     */
    static async executePing(client, pingData) {
        // Verify ping still exists and hasn't been executed
        const currentData = await client.db.get(pingData.id);
        if (!currentData) return;

        try {
            const channel = await client.channels.fetch(pingData.channelId);
            if (channel && channel.isTextBased()) {
                await channel.send({
                    content: `<@&${pingData.roleId}>\n\n${pingData.text}`
                });
                logger.info(`[PING] Executed ping ${pingData.id}`);
            } else {
                logger.warn(`[PING] Could not execute ping ${pingData.id}: Channel ${pingData.channelId} not found or not text-based`);
            }
        } catch (error) {
            logger.error(`[PING] Failed to send ping message for ${pingData.id}:`, error);
        } finally {
            if (pingData.intervalMs) {
                // Recurring ping
                if (pingData.commandToReset) {
                    // If there's a command to reset, we WAIT for it.
                    // Mark as waiting for reset and update DB without scheduling next timeout.
                    const updatedPingData = {
                        ...pingData,
                        isWaitingForReset: true,
                        scheduledTime: 0 // Set to 0 to indicate it's not currently active
                    };
                    await client.db.set(pingData.id, updatedPingData);
                    logger.info(`[PING] Recurring ping ${pingData.id} is now waiting for reset command "${pingData.commandToReset}"`);
                } else {
                    // Normal recurring ping: update scheduledTime and save back to DB
                    const nextTime = Date.now() + pingData.intervalMs;
                    const updatedPingData = {
                        ...pingData,
                        scheduledTime: nextTime
                    };
                    await client.db.set(pingData.id, updatedPingData);
                    this.setPingTimeout(client, updatedPingData);
                    logger.info(`[PING] Rescheduled recurring ping ${pingData.id} for ${new Date(nextTime).toISOString()}`);
                }
            } else {
                // One-time ping: clean up
                await client.db.delete(pingData.id);
                const pendingPings = await client.db.get('pings:pending', []);
                const updatedPings = pendingPings.filter(id => id !== pingData.id);
                await client.db.set('pings:pending', updatedPings);
            }
        }
    }

    /**
     * Resets the timer for a specific ping.
     * @param {object} client - Discord client.
     * @param {string} pingId - The ID of the ping to reset.
     */
    static async resetPing(client, pingId) {
        try {
            const pingData = await client.db.get(pingId);
            if (pingData && pingData.intervalMs) {
                const nextTime = Date.now() + pingData.intervalMs;
                const updatedPingData = {
                    ...pingData,
                    scheduledTime: nextTime,
                    isWaitingForReset: false // Clear the waiting flag
                };
                await client.db.set(pingData.id, updatedPingData);
                this.setPingTimeout(client, updatedPingData);
                logger.info(`[PING] Reset timer for recurring ping ${pingData.id}. Next ping at ${new Date(nextTime).toISOString()}`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`[PING] Error resetting ping ${pingId}:`, error);
            return false;
        }
    }

    /**
     * Handles a command being used, checking if it should reset any waiting pings.
     * @param {object} client - Discord client.
     * @param {string} guildId - The ID of the guild where the command was used.
     * @param {string} commandName - The name of the command that was used.
     */
    static async handleCommandUsed(client, guildId, commandName) {
        try {
            const pings = await this.getPingsForGuild(client, guildId);
            const lowerCaseCommandName = commandName.toLowerCase();

            for (const ping of pings) {
                if (ping.isWaitingForReset && ping.commandToReset && ping.commandToReset.toLowerCase() === lowerCaseCommandName) {
                    logger.info(`[PING] Resetting ping ${ping.id} due to command "${commandName}" usage.`);
                    await this.resetPing(client, ping.id);
                }
            }
        } catch (error) {
            logger.error(`[PING] Error handling command used for ping reset in guild ${guildId} for command ${commandName}:`, error);
        }
    }

    /**
     * Initializes pings from database on startup.
     * @param {object} client 
     */
    static async init(client) {
        try {
            // Initialize client.pingTimeouts map
            if (!client.pingTimeouts) {
                client.pingTimeouts = new Map();
            }

            const pendingPings = await client.db.get('pings:pending', []);
            logger.info(`[PING] Initializing ${pendingPings.length} pending pings from database`);

            for (const pingId of pendingPings) {
                const pingData = await client.db.get(pingId);
                if (pingData) {
                    // If a ping was waiting for reset, and the bot restarted,
                    // we should probably just reschedule it as if the command was used.
                    // Or, alternatively, keep it waiting. For now, let's keep it waiting.
                    if (pingData.isWaitingForReset) {
                        logger.debug(`[PING] Ping ${pingId} is waiting for reset command. Not rescheduling on init.`);
                        continue;
                    }

                    if (pingData.scheduledTime <= Date.now()) {
                        // If it should have fired already, fire it now
                        await this.executePing(client, pingData);
                    } else {
                        this.setPingTimeout(client, pingData);
                    }
                } else {
                    // Clean up orphaned ID
                    const currentPings = await client.db.get('pings:pending', []);
                    await client.db.set('pings:pending', currentPings.filter(id => id !== pingId));
                }
            }
        } catch (error) {
            logger.error('[PING] Error initializing pings:', error);
        }
    }
}

export default PingService;