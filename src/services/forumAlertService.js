import { MemoryStorage } from '../utils/memoryStorage.js';
import { logger } from '../utils/logger.js';
import { pgDb } from '../utils/postgresDatabase.js'; // Import pgDb

class ForumAlertService {
    constructor() {
        this.isPostgresAvailable = pgDb.isAvailable();
        if (this.isPostgresAvailable) {
            logger.info('ForumAlertService using PostgreSQL for persistence.');
            // Subscriptions will be managed directly via pgDb methods, not a local map.
            // We don't need to load all into memory on startup for pgDb.
        } else {
            this.memoryStorageInstance = new MemoryStorage();
            this.subscriptions = this.memoryStorageInstance.get('forumAlertSubscriptions') || new Map();
            this.memoryStorageInstance.set('forumAlertSubscriptions', this.subscriptions);
            logger.warn('PostgreSQL not available. ForumAlertService falling back to memoryStorage.');
        }
    }

    /**
     * Subscribes a user to alerts for a specific channel.
     * @param {string} userId The ID of the user.
     * @param {string} channelId The ID of the channel (forum post).
     * @param {string} guildId The ID of the guild.
     * @returns {Promise<boolean>} True if subscribed, false if already subscribed.
     */
    async subscribe(userId, channelId, guildId) {
        if (this.isPostgresAvailable) {
            const key = `forumalert:${guildId}:${channelId}:${userId}`;
            const existing = await pgDb.get(key);
            if (existing) {
                return false; // Already subscribed
            }
            // Store a simple object, value doesn't matter much, existence is key
            await pgDb.set(key, { guildId, channelId, userId });
            logger.debug(`User ${userId} subscribed to channel ${channelId} via PostgreSQL.`);
            return true;
        } else {
            if (!this.subscriptions.has(channelId)) {
                this.subscriptions.set(channelId, new Set());
            }
            const channelSubs = this.subscriptions.get(channelId);
            if (channelSubs.has(userId)) {
                return false; // Already subscribed
            }
            channelSubs.add(userId);
            this.memoryStorageInstance.set('forumAlertSubscriptions', this.subscriptions); // Persist changes
            logger.debug(`User ${userId} subscribed to channel ${channelId} via memoryStorage.`);
            return true;
        }
    }

    /**
     * Unsubscribes a user from alerts for a specific channel.
     * @param {string} userId The ID of the user.
     * @param {string} channelId The ID of the channel (forum post).
     * @returns {Promise<boolean>} True if unsubscribed, false if not subscribed.
     */
    async unsubscribe(userId, channelId) {
        if (this.isPostgresAvailable) {
            const key = `forumalert:${'any'}:${channelId}:${userId}`; // Guild ID is not needed for unsubscribe if we search by channel and user
            const deleted = await pgDb.delete(key); // pgDb.delete handles partial keys for forum_alert type
            logger.debug(`User ${userId} unsubscribed from channel ${channelId} via PostgreSQL.`);
            return deleted;
        } else {
            if (this.subscriptions.has(channelId)) {
                const channelSubs = this.subscriptions.get(channelId);
                if (channelSubs.delete(userId)) {
                    if (channelSubs.size === 0) {
                        this.subscriptions.delete(channelId); // Clean up if no more subscribers
                    }
                    this.memoryStorageInstance.set('forumAlertSubscriptions', this.subscriptions); // Persist changes
                    logger.debug(`User ${userId} unsubscribed from channel ${channelId} via memoryStorage.`);
                    return true;
                }
            }
            return false; // Not subscribed
        }
    }

    /**
     * Lists all channels a user is subscribed to.
     * @param {string} userId The ID of the user.
     * @returns {Promise<Array<{channelId: string, guildId: string}>>} An array of subscribed channel info.
     */
    async listSubscriptions(userId) {
        if (this.isPostgresAvailable) {
            // In pgDb, we need to query the forum_alerts table directly for all entries by userId
            const result = await pgDb.pool.query(
                `SELECT guild_id, channel_id FROM ${pgDb.pgConfig.tables.forum_alerts} WHERE user_id = $1`,
                [userId]
            );
            return result.rows.map(row => ({ channelId: row.channel_id, guildId: row.guild_id }));
        } else {
            const userChannels = [];
            for (const [channelId, userIds] of this.subscriptions.entries()) {
                if (userIds.has(userId)) {
                    userChannels.push({ channelId: channelId, guildId: 'unknown' }); // Placeholder for guildId
                }
            }
            logger.debug(`Listed subscriptions for user ${userId}: ${userChannels.length} channels.`);
            return userChannels;
        }
    }

    /**
     * Disables all alerts for a specific channel, effectively removing all subscriptions for it.
     * This is intended to be called when a forum post is closed.
     * @param {string} channelId The ID of the channel (forum post).
     * @returns {Promise<boolean>} True if subscriptions were removed, false if none existed.
     */
    async disableAlertsForChannel(channelId) {
        if (this.isPostgresAvailable) {
            // Delete all entries for a given channel_id
            const key = `forumalert:${'any'}:${channelId}`; // Partial key for deleting all for a channel
            const deleted = await pgDb.delete(key);
            logger.info(`Disabled alerts for channel ${channelId} via PostgreSQL. Removed subscriptions.`);
            return deleted;
        } else {
            if (this.subscriptions.has(channelId)) {
                const removedCount = this.subscriptions.get(channelId).size;
                this.subscriptions.delete(channelId);
                this.memoryStorageInstance.set('forumAlertSubscriptions', this.subscriptions); // Persist changes
                logger.info(`Disabled alerts for channel ${channelId} via memoryStorage. Removed ${removedCount} subscriptions.`);
                return true;
            }
            return false; // No subscriptions for this channel
        }
    }

    /**
     * Processes and sends out forum alerts to subscribed users.
     * This method is called by a cron job.
     * @param {object} bot The Discord client instance.
     */
    async processAlerts(bot) {
        logger.debug('[CRON] Processing forum alerts...');
        if (this.isPostgresAvailable) {
            // Fetch all subscriptions from the database
            const result = await pgDb.pool.query(
                `SELECT guild_id, channel_id, user_id FROM ${pgDb.pgConfig.tables.forum_alerts}`
            );
            const allSubscriptions = result.rows;

            // TODO: Implement actual alert processing logic here using allSubscriptions.
            // This would involve iterating through subscriptions, fetching new messages/activity,
            // and sending DMs or pings to subscribed users.
            logger.info(`[CRON] Found ${allSubscriptions.length} forum alert subscriptions to process.`);
        } else {
            // Logic for memoryStorage (similar to previous implementation)
            // This would involve iterating through this.subscriptions
            logger.info(`[CRON] Processing ${this.subscriptions.size} forum alert subscriptions from memoryStorage.`);
        }
    }
}

export const forumAlertService = new ForumAlertService();