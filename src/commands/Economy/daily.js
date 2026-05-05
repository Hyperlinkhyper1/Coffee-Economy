import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { formatDuration } from '../../utils/helpers.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

const DAILY_COOLDOWN = 18 * 60 * 60 * 1000;
const DAILY_AMOUNT = 1000;
const PREMIUM_BONUS_PERCENTAGE = 0.1;

export default {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your cash reward (Every 18 hours)'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;
            
            const userId = interaction.user.id;
            const guildId = interaction.guildId;
            const now = Date.now();

            logger.debug(`[ECONOMY] Daily claimed started for ${userId}`, { userId, guildId });

            const userData = await getEconomyData(client, guildId, userId);
            
            if (!userData) {
                throw createError(
                    "Failed to load economy data for daily",
                    ErrorTypes.DATABASE,
                    "Failed to load your economy data. Please try again later.",
                    { userId, guildId }
                );
            }
            
            const lastDaily = userData.lastDaily || 0;
            const streak = userData.dailyStreak || 0;

            if (now < lastDaily + DAILY_COOLDOWN) {
                const timeRemaining = lastDaily + DAILY_COOLDOWN - now;
                throw createError(
                    "Daily cooldown active",
                    ErrorTypes.RATE_LIMIT,
                    `You need to wait before claiming daily again. Try again in **${formatDuration(timeRemaining)}**.`,
                    { timeRemaining, cooldownType: 'daily' }
                );
            }

            // Check streak: If last claim was between 18h and 36h ago, increment streak.
            // If more than 36h ago, reset streak to 1.
            let newStreak = 1;
            if (lastDaily > 0) {
                const diff = now - lastDaily;
                if (diff < (DAILY_COOLDOWN * 2)) {
                    newStreak = streak + 1;
                }
            }

            const guildConfig = await getGuildConfig(client, guildId);
            const PREMIUM_ROLE_ID = guildConfig.premiumRoleId;

            let earned = DAILY_AMOUNT;
            let bonusMessage = "";
            let hasPremiumRole = false;

            if (
                PREMIUM_ROLE_ID &&
                interaction.member &&
                interaction.member.roles.cache.has(PREMIUM_ROLE_ID)
            ) {
                const bonusAmount = Math.floor(
                    DAILY_AMOUNT * PREMIUM_BONUS_PERCENTAGE,
                );
                earned += bonusAmount;
                bonusMessage = `\n✨ **Premium Bonus:** +$${bonusAmount.toLocaleString()}`;
                hasPremiumRole = true;
            }

            userData.wallet = (userData.wallet || 0) + earned;
            userData.lastDaily = now;
            userData.dailyStreak = newStreak;

            await setEconomyData(client, guildId, userId, userData);

            logger.info(`[ECONOMY_TRANSACTION] Daily claimed`, {
                userId,
                guildId,
                amount: earned,
                newWallet: userData.wallet,
                streak: newStreak,
                hasPremium: hasPremiumRole,
                timestamp: new Date().toISOString()
            });

            const embed = successEmbed(
                "✅ Daily Claimed!",
                `You have claimed your daily **$${earned.toLocaleString()}**!${bonusMessage}`
            )
                .addFields(
                    {
                        name: "New Cash Balance",
                        value: `$${userData.wallet.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: "Daily Streak",
                        value: `🔥 **${newStreak}** days`,
                        inline: true,
                    }
                )
                .setFooter({
                    text: hasPremiumRole
                        ? `Next claim in 18 hours. (Premium Active)`
                        : `Next claim in 18 hours.`,
                });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'daily' })
};




