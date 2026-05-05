import { Events } from "discord.js";
import { logger, startupLog } from "../utils/logger.js";
import config from "../config/application.js";
import { reconcileReactionRoleMessages } from "../services/reactionRoleService.js";
import { getEconomyData, setEconomyData } from '../utils/economy.js';

export default {
  name: Events.ClientReady,
  once: true,

  async execute(client) {
    try {
      client.user.setPresence(config.bot.presence);

      startupLog(`Ready! Logged in as ${client.user.tag}`);
      startupLog(`Serving ${client.guilds.cache.size} guild(s)`);
      startupLog(`Loaded ${client.commands.size} commands`);

      const reconciliationSummary = await reconcileReactionRoleMessages(client);
      startupLog(
        `Reaction role reconciliation: scanned ${reconciliationSummary.scannedMessages}, removed ${reconciliationSummary.removedMessages}, errors ${reconciliationSummary.errors}`
      );

      // Voice Time Tracker (runs every minute)
      setInterval(async () => {
        for (const guild of client.guilds.cache.values()) {
          for (const voiceState of guild.voiceStates.cache.values()) {
            if (voiceState.member.user.bot || !voiceState.channel) continue;
            if (voiceState.mute || voiceState.deaf) continue;

            try {
              const userData = await getEconomyData(client, guild.id, voiceState.member.id);
              if (!userData.stats) {
                userData.stats = { messages: 0, reactions: 0, voiceMinutes: 0, isBoosting: false };
              }
              userData.stats.voiceMinutes = (userData.stats.voiceMinutes || 0) + 1;
              await setEconomyData(client, guild.id, voiceState.member.id, userData);
            } catch (error) {
              logger.error(`Error tracking voice time for ${voiceState.member.id}:`, error);
            }
          }
        }
      }, 60000);
    } catch (error) {
      logger.error("Error in ready event:", error);
    }
  },
};


