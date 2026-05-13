import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';
import { getLevelingConfig, getUserLevelData } from '../services/leveling.js';
import { addXp } from '../services/xpSystem.js';
import { checkRateLimit } from '../utils/rateLimiter.js';
import { getEconomyData, setEconomyData } from '../utils/economy.js';
import { checkAndAnnounceAchievements } from '../config/achievements.js';
import PingService from '../services/pingService.js'; // Import PingService

const MESSAGE_XP_RATE_LIMIT_ATTEMPTS = 12;
const MESSAGE_XP_RATE_LIMIT_WINDOW_MS = 10000;

export default {
  name: Events.MessageCreate,
  async execute(message, client) {
    try {
      
      if (message.author.bot || !message.guild) return;

      await handleStatsTracking(message, client);
      await handleLeveling(message, client);
      await handlePingReset(message, client); // Add this new handler
    } catch (error) {
      logger.error('Error in messageCreate event:', error);
    }
  }
};

async function handleStatsTracking(message, client) {
  try {
    const userData = await getEconomyData(client, message.guild.id, message.author.id);
    if (!userData.stats) {
      userData.stats = { messages: 0, reactions: 0, voiceMinutes: 0, isBoosting: false };
    }
    userData.stats.messages = (userData.stats.messages || 0) + 1;
    
    await checkAndAnnounceAchievements(client, message.guild, message.member, userData);
    
    await setEconomyData(client, message.guild.id, message.author.id, userData);
  } catch (error) {
    logger.error('Error tracking message stats:', error);
  }
}

async function handleLeveling(message, client) {
  try {
    const rateLimitKey = `xp-event:${message.guild.id}:${message.author.id}`;
    const canProcess = await checkRateLimit(rateLimitKey, MESSAGE_XP_RATE_LIMIT_ATTEMPTS, MESSAGE_XP_RATE_LIMIT_WINDOW_MS);
    if (!canProcess) {
      return;
    }

    const levelingConfig = await getLevelingConfig(client, message.guild.id);
    
    if (!levelingConfig?.enabled) {
      return;
    }

    
    if (levelingConfig.ignoredChannels?.includes(message.channel.id)) {
      return;
    }

    
    if (levelingConfig.ignoredRoles?.length > 0) {
      const member = await message.guild.members.fetch(message.author.id).catch(() => {
        return null;
      });
      if (member && member.roles.cache.some(role => levelingConfig.ignoredRoles.includes(role.id))) {
        return;
      }
    }

    
    if (levelingConfig.blacklistedUsers?.includes(message.author.id)) {
      return;
    }

    
    if (!message.content || message.content.trim().length === 0) {
      return;
    }

    const userData = await getUserLevelData(client, message.guild.id, message.author.id);
    
    
    const cooldownTime = levelingConfig.xpCooldown || 60;
    const now = Date.now();
    const timeSinceLastMessage = now - (userData.lastMessage || 0);
    
    
    if (timeSinceLastMessage < cooldownTime * 1000) {
      return;
    }

    
    const minXP = levelingConfig.xpRange?.min || levelingConfig.xpPerMessage?.min || 15;
    const maxXP = levelingConfig.xpRange?.max || levelingConfig.xpPerMessage?.max || 25;

    
    const safeMinXP = Math.max(1, minXP);
    const safeMaxXP = Math.max(safeMinXP, maxXP);

    
    const xpToGive = Math.floor(Math.random() * (safeMaxXP - safeMinXP + 1)) + safeMinXP;

    
    let finalXP = xpToGive;
    if (levelingConfig.xpMultiplier && levelingConfig.xpMultiplier > 1) {
      finalXP = Math.floor(finalXP * levelingConfig.xpMultiplier);
    }

    
    const result = await addXp(client, message.guild, message.member, finalXP);
    
    if (result.success && result.leveledUp) {
      logger.info(
        `${message.author.tag} leveled up to level ${result.level} in ${message.guild.name}`
      );
    }
  } catch (error) {
    logger.error('Error handling leveling for message:', error);
  }
}

async function handlePingReset(message, client) {
  try {
    const guildId = message.guild.id;
    const content = message.content.trim();

    // Get all pings for the guild
    const allPingIds = await client.db.get('pings:pending', []);
    const guildPings = [];
    for (const pingId of allPingIds) {
        const pingData = await client.db.get(pingId);
        if (pingData && pingData.guildId === guildId && pingData.commandToReset) {
            guildPings.push(pingData);
        }
    }

    for (const ping of guildPings) {
        // Normalize the command to reset (e.g., remove leading slash if present)
        const commandToResetNormalized = ping.commandToReset.startsWith('/')
            ? ping.commandToReset.substring(1)
            : ping.commandToReset;

        // Check if the message content starts with the command to reset
        // This handles both native Discord commands (e.g., /work) and bot commands (e.g., !work, .work)
        if (content.startsWith(commandToResetNormalized) || content.startsWith(`/${commandToResetNormalized}`)) {
            logger.info(`[PING] Command "${content}" matched reset command "${ping.commandToReset}" for ping ${ping.id}. Resetting timer.`);
            await PingService.resetPing(client, ping.id);
        }
    }
  } catch (error) {
    logger.error('Error handling ping reset:', error);
  }
}
