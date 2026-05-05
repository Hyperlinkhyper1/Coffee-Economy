import { Events } from 'discord.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { logger } from '../utils/logger.js';
import { getEconomyData, setEconomyData } from '../utils/economy.js';
import { checkAndAnnounceAchievements } from '../config/achievements.js';

export default {
  name: Events.GuildMemberUpdate,
  once: false,

  async execute(oldMember, newMember) {
    try {
      if (!newMember.guild) return;

      await handleBoostTracking(oldMember, newMember);

      const fields = [];

      
      fields.push({
        name: '👤 Member',
        value: `${newMember.user.tag} (${newMember.user.id})`,
        inline: true
      });

      
      if (oldMember.nickname !== newMember.nickname) {
        fields.push({
          name: '🏷️ Old Nickname',
          value: oldMember.nickname || '*(no nickname)*',
          inline: true
        });

        fields.push({
          name: '🏷️ New Nickname',
          value: newMember.nickname || '*(no nickname)*',
          inline: true
        });

        await logEvent({
          client: newMember.client,
          guildId: newMember.guild.id,
          eventType: EVENT_TYPES.MEMBER_NAME_CHANGE,
          data: {
            description: `Member nickname changed: ${newMember.user.tag}`,
            userId: newMember.user.id,
            fields
          }
        });

        return;
      }

    } catch (error) {
      logger.error('Error in guildMemberUpdate event:', error);
    }
  }
};

async function handleBoostTracking(oldMember, newMember) {
  try {
    const isBoosting = !!newMember.premiumSince;
    const wasBoosting = !!oldMember.premiumSince;

    if (isBoosting !== wasBoosting) {
      const userData = await getEconomyData(newMember.client, newMember.guild.id, newMember.user.id);
      if (!userData.stats) {
        userData.stats = { messages: 0, reactions: 0, voiceMinutes: 0, isBoosting: false };
      }
      userData.stats.isBoosting = isBoosting;

      await checkAndAnnounceAchievements(newMember.client, newMember.guild, newMember, userData);

      await setEconomyData(newMember.client, newMember.guild.id, newMember.user.id, userData);
    }
  } catch (error) {
    logger.error('Error tracking boost stats:', error);
  }
}
