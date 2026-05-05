import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getEconomyData, setEconomyData } from '../utils/economy.js';
import { checkAndAnnounceAchievements } from '../config/achievements.js';

export default {
    name: Events.MessageReactionAdd,
    async execute(reaction, user, client) {
        try {
            if (user.bot || !reaction.message.guild) return;

            const guildId = reaction.message.guild.id;
            const userId = user.id;

            const userData = await getEconomyData(client, guildId, userId);
            if (!userData.stats) {
                userData.stats = { messages: 0, reactions: 0, voiceMinutes: 0, isBoosting: false };
            }
            
            userData.stats.reactions = (userData.stats.reactions || 0) + 1;

            await checkAndAnnounceAchievements(client, reaction.message.guild, reaction.message.guild.members.cache.get(userId), userData);

            await setEconomyData(client, guildId, userId, userData);
        } catch (error) {
            logger.error('Error tracking reaction stats:', error);
        }
    }
};
