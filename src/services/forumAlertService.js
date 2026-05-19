import { MemoryStorage } from '../utils/memoryStorage.js';
import { logger } from '../utils/logger.js';
import { pgDb } from '../utils/postgresDatabase.js'; // Import pgDb

class ForumAlertService {
    constructor() {
        this.isPostgresAvailable = pgDb.isAvailable();
        if (this.isPostgresAvailable) {
            logger.info('ForumAlertService using PostgreSQL for persistence.');
            this.subscriptions = null; // Not used when PostgreSQL is active
            this.memoryStorageInstance = null; // Not used when PostgreSQL is active
        } else {
            this.memoryStorageInstance = new MemoryStorage();
            let stored = this.memoryStorageInstance.get('forumAlertSubscriptions');
            if (stored instanceof Map) {
                this.subscriptions = stored;
            } else {
                // If for some reason it's not a Map (e.g., first run, or corrupted data), initialize as new Map
                logger.warn(`[FORUM_ALERT_SERVICE] Initializing memory subscriptions as new Map. Stored value was: ${stored}`);
                this.subscriptions = new Map();
                this.memoryStorageInstance.set('forumAlertSubscriptions', this.subscriptions);
            }
            logger.warn('PostgreSQL not available. ForumAlertService falling back to memoryStorage.');
        }
    }

    // Defensive check helper
    _ensureMemorySubscriptionsAreMap() {
        if (!this.subscriptions || !(this.subscriptions instanceof Map)) {
            logger.error(`[FORUM_ALERT_SERVICE] MemoryStorage subscriptions are not a Map! Re-initializing. Current type: ${typeof this.subscriptions}, value: ${this.subscriptions}`);
            this.subscriptions = new Map();
            if (this.memoryStorageInstance) {
                this.memoryStorageInstance.set('forumAlertSubscriptions', this.subscriptions);
            } else {
                // This case should ideally not happen if constructor logic is correct
                logger.warn('[FORUM_ALERT_SERVICE] memoryStorageInstance was null during re-initialization of subscriptions.');
                this.memoryStorageInstance = new MemoryStorage(); // Re-initialize memoryStorageInstance as well
                this.memoryStorageInstance.set('forumAlertSubscriptions', this.subscriptions);
            }
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
            this._ensureMemorySubscriptionsAreMap(); // Defensive check
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
            // The pgDb.delete method for 'forum_alert' type handles deletion by guild_id, channel_id, user_id
            // So we need to provide all three to delete a specific subscription.
            // If we only provide channel_id, it deletes all for that channel.
            // For unsubscribe, we want to delete a specific user's subscription to a specific channel.
            const key = `forumalert:${'any'}:${channelId}:${userId}`; // 'any' for guildId will be ignored by deleteStructuredData if userId is present
            const deleted = await pgDb.delete(key);
            logger.debug(`User ${userId} unsubscribed from channel ${channelId} via PostgreSQL.`);
            return deleted;
        } else {
            this._ensureMemorySubscriptionsAreMap(); // Defensive check
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
            this._ensureMemorySubscriptionsAreMap(); // Defensive check
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
            // The deleteStructuredData for 'forum_alert' type handles deletion by channel_id if userId is not provided.
            const key = `forumalert:${'any'}:${channelId}`; // 'any' for guildId will be ignored by deleteStructuredData if channelId is present
            const deleted = await pgDb.delete(key);
            logger.info(`Disabled alerts for channel ${channelId} via PostgreSQL. Removed subscriptions.`);
            return deleted;
        } else {
            this._ensureMemorySubscriptionsAreMap(); // Defensive check
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
        let allSubscriptions = [];

        if (this.isPostgresAvailable) {
            const result = await pgDb.pool.query(
                `SELECT guild_id, channel_id, user_id FROM ${pgDb.pgConfig.tables.forum_alerts}`
            );
            allSubscriptions = result.rows;
        } else {
            this._ensureMemorySubscriptionsAreMap(); // Defensive check
            // Convert memoryStorage subscriptions to a similar format
            for (const [channelId, userIds] of this.subscriptions.entries()) {
                for (const userId of userIds) {
                    allSubscriptions.push({ guild_id: 'unknown', channel_id: channelId, user_id: userId });
                }
            }
        }

        if (allSubscriptions.length === 0) {
            logger.debug('[CRON] No forum alert subscriptions found to process.');
            return;
        }

        logger.info(`[CRON] Found ${allSubscriptions.length} forum alert subscriptions to process.`);

        for (const sub of allSubscriptions) {
            try {
                const channel = await bot.channels.cache.get(sub.channel_id);
                const user = await bot.users.cache.get(sub.user_id);

                if (!channel) {
                    logger.warn(`[CRON] Forum alert channel ${sub.channel_id} not found for user ${sub.user_id}. Removing subscription.`);
                    // Optionally remove subscription if channel is no longer accessible
                    await this.unsubscribe(sub.user_id, sub.channel_id);
                    continue;
                }
                if (!user) {
                    logger.warn(`[CRON] Forum alert user ${sub.user_id} not found for channel ${sub.channel_id}. Removing subscription.`);
                    // Optionally remove subscription if user is no longer accessible
                    await this.unsubscribe(sub.user_id, sub.channel_id);
                    continue;
                }

                // TODO: Implement actual alert processing logic here.
                // This would involve:
                // 1. Fetching new messages/activity in 'channel' since the last alert was sent (or a reasonable timeframe).
                // 2. Filtering relevant activity (e.g., new replies, specific keywords).
                // 3. Formatting an alert message.
                // 4. Sending a DM to 'user' or a ping in a designated alert channel.
                logger.debug(`[CRON] Placeholder: Would send alert to user ${user.tag} for channel ${channel.name} (${channel.id}).`);

            } catch (error) {
                logger.error(`[CRON] Error processing alert for subscription (guild: ${sub.guild_id}, channel: ${sub.channel_id}, user: ${sub.user_id}):`, error);
            }
        }
    }
}

export const forumAlertService = new ForumAlertService();