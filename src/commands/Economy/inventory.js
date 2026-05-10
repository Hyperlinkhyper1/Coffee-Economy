import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { shopItems } from '../../config/shop/items.js';
import { getEconomyData } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import CardService from '../../services/cardService.js';

const SHOP_ITEMS = shopItems;

export default {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View your economy inventory'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

            const userId = interaction.user.id;
            const guildId = interaction.guildId;

            logger.debug(`[ECONOMY] Inventory requested for ${userId}`, { userId, guildId });

            const userData = await getEconomyData(client, guildId, userId);

            if (!userData) {
                throw createError(
                    "Failed to load economy data for inventory",
                    ErrorTypes.DATABASE,
                    "Failed to load your economy data. Please try again later.",
                    { userId, guildId }
                );
            }

            const inventory = userData.inventory || {};
            const userCards = await CardService.getUserCards(client, guildId, userId);

            let inventoryDescription = "Your inventory is currently empty.";
            let hasItems = false;
            let hasCards = false;

            // Process shop items
            let itemLines = [];
            if (Object.keys(inventory).length > 0) {
                itemLines = Object.entries(inventory)
                    .filter(
                        ([itemId, quantity]) => {
                            const item = SHOP_ITEMS.find(i => i.id === itemId);
                            return quantity > 0 && item;
                        }
                    )
                    .map(
                        ([itemId, quantity]) => {
                            const item = SHOP_ITEMS.find(i => i.id === itemId);
                            const rarityText = item.rarity ? ` [[1;35m${item.rarity}[0m]` : "";
                            // Using [1;37m for brightest white on name and quantity
                            return `[1;37m${item.name}: ${quantity}x[0m${rarityText}`;
                        }
                    );
                hasItems = itemLines.length > 0;
            }

            // Process cards
            let cardLines = [];
            if (Object.keys(userCards).length > 0) {
                for (const [cardKey, quantity] of Object.entries(userCards)) {
                    if (quantity > 0) {
                        const [cardName, rarityName] = cardKey.split(':');
                        const rarityDetails = await CardService.getRarityDetails(client, guildId, rarityName);
                        const rarityColor = rarityDetails ? rarityDetails.color : '37'; // Default to white
                        cardLines.push(`[1;${rarityColor}m${cardName}: ${quantity}x [${rarityName}][0m`);
                    }
                }
                hasCards = cardLines.length > 0;
            }

            // Combine descriptions
            if (hasItems || hasCards) {
                let descriptionParts = [];

                if (hasItems) {
                    descriptionParts.push("**🛒 Shop Items:**\n```ansi\n" + itemLines.join("\n") + "\n```");
                }

                if (hasCards) {
                    descriptionParts.push("**🎴 Cards:**\n```ansi\n" + cardLines.join("\n") + "\n```");
                }

                inventoryDescription = descriptionParts.join("\n\n");
            }

            logger.info(`[ECONOMY] Inventory retrieved`, { 
                userId, 
                guildId,
                itemCount: Object.keys(inventory).length,
                cardCount: Object.keys(userCards).length
            });

            const embed = createEmbed({ 
                title: `📦 ${interaction.user.username}'s Inventory`, 
                description: inventoryDescription, 
            }).setThumbnail(interaction.user.displayAvatarURL());

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'inventory' })
};








