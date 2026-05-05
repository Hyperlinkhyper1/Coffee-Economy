import { SlashCommandBuilder } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed } from '../../utils/embeds.js';
import { addMoney, getEconomyData, setEconomyData } from '../../utils/economy.js';
import { shopItems } from '../../config/shop/items.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('redeem')
        .setDescription('Redeem a reward code')
        .addStringOption(option =>
            option.setName('code')
                .setDescription('The code to redeem')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        await InteractionHelper.safeDefer(interaction, { ephemeral: true });

        const code = interaction.options.getString('code');
        const codeKey = `codes:${interaction.guildId}:${code}`;
        
        const codeData = await client.db.get(codeKey);

        if (!codeData) {
            throw createError(
                "Invalid Code",
                ErrorTypes.VALIDATION,
                `The code \`${code}\` is invalid or has expired.`
            );
        }

        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        if (!codeData.redeemedBy) {
            codeData.redeemedBy = [];
            // Migration for old codes
            if (codeData.redeemed && codeData.redeemerId) {
                codeData.redeemedBy.push(codeData.redeemerId);
            }
        }

        if (codeData.redeemedBy.includes(userId)) {
            throw createError(
                "Code Already Redeemed",
                ErrorTypes.VALIDATION,
                `You have already used the code \`${code}\`.`
            );
        }

        const rewards = [];

        // Load user data once if needed for items
        let userData = null;

        // Grant money rewards
        if (codeData.money > 0) {
            const result = await addMoney(client, guildId, userId, codeData.money);
            if (result.success) {
                rewards.push(`💰 **$${codeData.money.toLocaleString()}**`);
            } else {
                throw createError(
                    "Redemption Failed",
                    ErrorTypes.DATABASE,
                    "Failed to add money to your account. Please try again later."
                );
            }
        }

        // Grant item rewards
        if (codeData.item) {
            const item = shopItems.find(i => i.id === codeData.item || i.name.toLowerCase() === codeData.item.toLowerCase());
            
            if (item) {
                if (!userData) userData = await getEconomyData(client, guildId, userId);
                
                const inventory = userData.inventory || {};
                inventory[item.id] = (inventory[item.id] || 0) + 1;
                userData.inventory = inventory;
                
                await setEconomyData(client, guildId, userId, userData);
                rewards.push(`${item.emoji || '📦'} **${item.name}**`);
            } else {
                rewards.push(`📦 **${codeData.item}** (Item not found in registry)`);
            }
        }

        // Mark as redeemed
        codeData.redeemedBy.push(userId);
        codeData.redeemed = true; // Still keep this for backward compatibility or general status
        await client.db.set(codeKey, codeData);

        logger.info(`[ECONOMY] Code redeemed: ${code} by ${userId} in guild ${guildId}`);

        const embed = successEmbed(
            `You have successfully redeemed code \`${code}\`!\n\n**Rewards Received:**\n${rewards.join('\n')}`,
            "Code Redeemed"
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'redeem' })
};

