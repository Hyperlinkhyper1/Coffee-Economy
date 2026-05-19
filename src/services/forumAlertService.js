import { MemoryStorage } from '../utils/memoryStorage.js'; // Correctly import the class
import { logger } from '../utils/logger.js';

// This service will manage forum alert subscriptions.
// It should ideally interact with postgresDatabase.js, but for now, we'll use memoryStorage as a fallback.

class ForumAlertService {
    constructor() {
        // Using memoryStorage for now. In a real scenario, this would be a database client.
        // Structure: Map<channelId, Set<userId>>
        this.memoryStorageInstance = new MemoryStorage(); // Instantiate the MemoryStorage class
        this.subscriptions = this.memoryStorageInstance.get('forumAlertSubscriptions') || new Map();
        this.memoryStorageInstance.set('forumAlertSubscriptions', this.subscriptions);
        logger.info('ForumAlertService initialized with memoryStorage.');
    }

    /**
     * Subscribes a user to alerts for a specific channel.
     * @param {string} userId The ID of the user.
     * @param {string} channelId The ID of the channel (forum post).
     * @param {string} guildId The ID of the guild.
     * @returns {Promise<boolean>} True if subscribed, false if already subscribed.
     */
    async subscribe(userId, channelId, guildId) {
        if (!this.subscriptions.has(channelId)) {
            this.subscriptions.set(channelId, new Set());
        }
        const channelSubs = this.subscriptions.get(channelId);
        if (channelSubs.has(userId)) {
            return false; // Already subscribed
        }
        channelSubs.add(userId);
        this.memoryStorageInstance.set('forumAlertSubscriptions', this.subscriptions); // Persist changes
        logger.debug(`User ${userId} subscribed to channel ${channelId}.`);
        return true;
    }

    /**
     * Unsubscribes a user from alerts for a specific channel.
     * @param {string} userId The ID of the user.
     * @param {string} channelId The ID of the channel (forum post).
     * @returns {Promise<boolean>} True if unsubscribed, false if not subscribed.
     */
    async unsubscribe(userId, channelId) {
        if (this.subscriptions.has(channelId)) {
            const channelSubs = this.subscriptions.get(channelId);
            if (channelSubs.delete(userId)) {
                if (channelSubs.size === 0) {
                    this.subscriptions.delete(channelId); // Clean up if no more subscribers
                }
                this.memoryStorageInstance.set('forumAlertSubscriptions', this.subscriptions); // Persist changes
                logger.debug(`User ${userId} unsubscribed from channel ${channelId}.`);
                return true;
            }
        }
        return false; // Not subscribed
    }

    /**
     * Lists all channels a user is subscribed to.
     * @param {string} userId The ID of the user.
     * @returns {Promise<Array<{channelId: string, guildId: string}>>} An array of subscribed channel info.
     */
    async listSubscriptions(userId) {
        const userChannels = [];
        for (const [channelId, userIds] of this.subscriptions.entries()) {
            if (userIds.has(userId)) {
                // In a real scenario, we'd fetch guildId from the stored data or Discord API if needed.
                // For memoryStorage, we only store channelId and userId.
                userChannels.push({ channelId: channelId, guildId: 'unknown' }); // Placeholder for guildId
            }
        }
        logger.debug(`Listed subscriptions for user ${userId}: ${userChannels.length} channels.`);
        return userChannels;
    }

    /**
     * Disables all alerts for a specific channel, effectively removing all subscriptions for it.
     * This is intended to be called when a forum post is closed.
     * @param {string} channelId The ID of the channel (forum post).
     * @returns {Promise<boolean>} True if subscriptions were removed, false if none existed.
     */
    async disableAlertsForChannel(channelId) {
        if (this.subscriptions.has(channelId)) {
            const removedCount = this.subscriptions.get(channelId).size;
            this.subscriptions.delete(channelId);
            this.memoryStorageInstance.set('forumAlertSubscriptions', this.subscriptions); // Persist changes
            logger.info(`Disabled alerts for channel ${channelId}. Removed ${removedCount} subscriptions.`);
            return true;
        }
        return false; // No subscriptions for this channel
    }
}

export const forumAlertService = new ForumAlertService();