import { logger } from '../utils/logger.js';

export class ForumAlertService {
    static getAlertsKey(guildId) {
        return `guild:${guildId}:forum_alerts`;
    }

    static async getAlerts(client, guildId) {
        return await client.db.get(this.getAlertsKey(guildId), []);
    }

    static async saveAlerts(client, guildId, alerts) {
        return await client.db.set(this.getAlertsKey(guildId), alerts);
    }

    static async addAlert(client, guildId, channelId, tag) {
        const alerts = await this.getAlerts(client, guildId);
        const existing = alerts.find(a => a.tag === tag);
        
        if (existing) {
            existing.channelId = channelId;
        } else {
            alerts.push({
                tag,
                channelId,
                interval: 24 * 60 * 60 * 1000, // Default 1 day
                lastPing: 0,
                pingUsers: []
            });
        }
        
        await this.saveAlerts(client, guildId, alerts);
        return true;
    }

    static async updateConfig(client, guildId, tag, intervalStr) {
        const interval = this.parseInterval(intervalStr);
        if (!interval) return false;

        const alerts = await this.getAlerts(client, guildId);
        const alert = alerts.find(a => a.tag === tag);
        if (!alert) return false;

        alert.interval = interval;
        await this.saveAlerts(client, guildId, alerts);
        return true;
    }

    static async toggleUser(client, guildId, tag, userId) {
        const alerts = await this.getAlerts(client, guildId);
        const alert = alerts.find(a => a.tag === tag);
        if (!alert) return { success: false, message: 'Alert not found' };

        const userIndex = alert.pingUsers.indexOf(userId);
        let added = false;
        if (userIndex === -1) {
            alert.pingUsers.push(userId);
            added = true;
        } else {
            alert.pingUsers.splice(userIndex, 1);
        }

        await this.saveAlerts(client, guildId, alerts);
        return { success: true, added };
    }

    static parseInterval(str) {
        const match = str.match(/^(\d+)([hd])$/i);
        if (!match) return null;

        const val = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        if (unit === 'h') return val * 60 * 60 * 1000;
        if (unit === 'd') return val * 24 * 60 * 60 * 1000;
        return null;
    }

    static async processAlerts(client) {
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                const alerts = await this.getAlerts(client, guildId);
                let changed = false;
                const now = Date.now();

                for (const alert of alerts) {
                    if (alert.pingUsers.length === 0) continue;
                    
                    if (now >= alert.lastPing + alert.interval) {
                        const channel = guild.channels.cache.get(alert.channelId);
                        if (channel && channel.isTextBased()) {
                            const pings = alert.pingUsers.map(id => `<@${id}>`).join(' ');
                            await channel.send({
                                content: `🔔 **Forum Alert: ${alert.tag}**\n${pings}\nThis is your scheduled reminder.`
                            }).catch(err => logger.error(`Failed to send alert in ${alert.channelId}:`, err));
                            
                            alert.lastPing = now;
                            changed = true;
                        }
                    }
                }

                if (changed) {
                    await this.saveAlerts(client, guildId, alerts);
                }
            } catch (error) {
                logger.error(`Error processing alerts for guild ${guildId}:`, error);
            }
        }
    }
}
