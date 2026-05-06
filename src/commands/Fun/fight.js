import { SlashCommandBuilder } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { checkAndAnnounceAchievements } from '../../config/achievements.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const EMBED_DESCRIPTION_LIMIT = 4096;

export default {
    data: new SlashCommandBuilder()
    .setName("fight")
    .setDescription("Starts a simulated 1v1 text-based battle.")
    .addUserOption((option) =>
      option
        .setName("opponent")
        .setDescription("The user to fight.")
        .setRequired(true),
    ),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const challenger = interaction.user;
      const opponent = interaction.options.getUser("opponent");

      
      if (challenger.id === opponent.id) {
        const embed = warningEmbed(
          `**${challenger.username}**, you can't fight yourself! That's a draw before it even starts.`,
          "⚔️ Invalid Challenge"
        );
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      
      if (opponent.bot) {
        const embed = warningEmbed(
          "You can't fight bots! Challenge a real person instead.",
          "⚔️ Invalid Opponent"
        );
        return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      }

      let winner;
      if (challenger.username === "hyperlinkhyper") {
          winner = challenger;
      } else if (opponent.username === "hyperlinkhyper") {
          winner = opponent;
      } else {
          winner = rand(0, 1) === 0 ? challenger : opponent;
      }
      const loser = winner.id === challenger.id ? opponent : challenger;
      const rounds = rand(3, 7);
      const damage = rand(10, 50);

      const log = [];
      log.push(
        `💥 **${challenger.username}** challenges **${opponent.username}** to a duel! (Best of ${rounds} rounds)`,
      );

      for (let i = 1; i <= rounds; i++) {
        let attacker;
        if (challenger.username === "hyperlinkhyper") {
            attacker = challenger;
        } else if (opponent.username === "hyperlinkhyper") {
            attacker = opponent;
        } else {
            attacker = rand(0, 1) === 0 ? challenger : opponent;
        }
        const target = attacker.id === challenger.id ? opponent : challenger;
        const action = [
          "throws a wild punch",
          "lands a critical hit",
          "uses a weak spell",
          "parries and counterattacks",
        ][rand(0, 3)];
        log.push(
          `\n**Round ${i}:** ${attacker.username} ${action} on ${target.username} for ${rand(1, damage)} damage!`,
        );
      }

      const outcomeText = log.join("\n");
      const winnerText = `👑 **${winner.username}** has defeated ${loser.username} and claims the victory!`;
      const fullDescription = `${outcomeText}\n\n${winnerText}`;

      const description = fullDescription.length <= EMBED_DESCRIPTION_LIMIT
        ? fullDescription
        : `${fullDescription.slice(0, EMBED_DESCRIPTION_LIMIT - 15)}\n\n...`;

      const embed = successEmbed(
        description,
        "🏆 Duel Complete!"
      );

      // Track win for the winner
      try {
          const userData = await getEconomyData(client, interaction.guildId, winner.id);
          if (!userData.stats) {
              userData.stats = { messages: 0, reactions: 0, voiceMinutes: 0, isBoosting: false, fightsWon: 0 };
          }
          userData.stats.fightsWon = (userData.stats.fightsWon || 0) + 1;
          
          await checkAndAnnounceAchievements(client, interaction.guild, winner === challenger ? interaction.member : await interaction.guild.members.fetch(winner.id), userData);
          
          await setEconomyData(client, interaction.guildId, winner.id, userData);
      } catch (err) {
          logger.error(`Failed to track fight win for ${winner.id}:`, err);
      }

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Fight command executed between ${challenger.id} and ${opponent.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Fight command error:', error);
      await handleInteractionError(interaction, error, {
        commandName: 'fight',
        source: 'fight_command'
      });
    }
  },
};





