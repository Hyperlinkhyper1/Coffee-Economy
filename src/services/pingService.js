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
     */
    static async schedulePing(client, guildId, channelId, roleId, delayMs, text) {
        const scheduledTime = Date.now() + delayMs;
        const pingId = `ping:${guildId}:${Date.now()}:${Math.floor(Math.random() * 1000)}`;
        
        const pingData = {
            id: pingId,
            guildId,
            channelId,
            roleId,
            scheduledTime,
            text,
            createdAt: Date.now()
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
     * Sets a timeout to execute a ping.
     * @param {object} client 
     * @param {object} pingData 
     */
    static setPingTimeout(client, pingData) {
        const now = Date.now();
        const delay = Math.max(0, pingData.scheduledTime - now);

        setTimeout(async () => {
            try {
                await this.executePing(client, pingData);
            } catch (error) {
                logger.error(`[PING] Error in ping timeout for ${pingData.id}:`, error);
            }
        }, delay);
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
            // Clean up
            await client.db.delete(pingData.id);
            const pendingPings = await client.db.get('pings:pending', []);
            const updatedPings = pendingPings.filter(id => id !== pingData.id);
            await client.db.set('pings:pending', updatedPings);
        }
    }

    /**
     * Initializes pings from database on startup.
     * @param {object} client 
     */
    static async init(client) {
        try {
            const pendingPings = await client.db.get('pings:pending', []);
            logger.info(`[PING] Initializing ${pendingPings.length} pending pings from database`);

            for (const pingId of pendingPings) {
                const pingData = await client.db.get(pingId);
                if (pingData) {
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
