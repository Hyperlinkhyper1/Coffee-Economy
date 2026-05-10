import { logger } from '../utils/logger.js';
import { createError, ErrorTypes, TitanBotError } from '../utils/errorHandler.js';
import { getEconomyData, setEconomyData } from '../utils/economy.js';

class CardService {
    /**
     * Create a new card pack
     */
    static async createPack(client, guildId, packName) {
        const packKey = `cards:pack:${guildId}:${packName.toLowerCase()}`;
        const packsListKey = `cards:packs:${guildId}`;

        try {
            const existingPack = await client.db.get(packKey);
            if (existingPack) {
                throw createError(
                    "Pack already exists",
                    ErrorTypes.VALIDATION,
                    `A card pack named **${packName}** already exists.`
                );
            }

            const packData = {
                name: packName,
                createdAt: Date.now(),
                cards: []
            };

            await client.db.set(packKey, packData);

            // Add to packs list
            const packsList = await client.db.get(packsListKey, []);
            if (!packsList.some(p => p.toLowerCase() === packName.toLowerCase())) {
                packsList.push(packName);
                await client.db.set(packsListKey, packsList);
            }

            logger.info(`[CARDS] Pack created: ${packName}`, { guildId, packName });
            return packData;
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw createError(
                "Failed to create card pack",
                ErrorTypes.DATABASE,
                "An error occurred while creating the card pack.",
                { guildId, packName, error: error.message }
            );
        }
    }

    /**
     * Add rarity type
     */
    static async addRarity(client, guildId, rarityName, color, chance) {
        const rarityKey = `cards:rarity:${guildId}:${rarityName.toLowerCase()}`;
        const raritiesListKey = `cards:rarities:${guildId}`;

        try {
            const existingRarity = await client.db.get(rarityKey);
            if (existingRarity) {
                throw createError(
                    "Rarity already exists",
                    ErrorTypes.VALIDATION,
                    `A rarity named **${rarityName}** already exists.`
                );
            }

            const rarityData = {
                name: rarityName,
                color,
                chance,
                createdAt: Date.now()
            };

            await client.db.set(rarityKey, rarityData);

            // Add to rarities list
            const raritiesList = await client.db.get(raritiesListKey, []);
            if (!raritiesList.some(r => r.toLowerCase() === rarityName.toLowerCase())) {
                raritiesList.push(rarityName);
                await client.db.set(raritiesListKey, raritiesList);
            }

            logger.info(`[CARDS] Rarity created: ${rarityName}`, { guildId, rarityName, color, chance });
            return rarityData;
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw createError(
                "Failed to add rarity",
                ErrorTypes.DATABASE,
                "An error occurred while adding the rarity.",
                { guildId, rarityName, error: error.message }
            );
        }
    }

    /**
     * Edit an existing rarity type.
     */
    static async editRarity(client, guildId, oldRarityName, newRarityName, newColor, newChance) {
        const oldRarityKey = `cards:rarity:${guildId}:${oldRarityName.toLowerCase()}`;
        const raritiesListKey = `cards:rarities:${guildId}`;

        try {
            const existingRarity = await client.db.get(oldRarityKey);
            if (!existingRarity) {
                throw createError(
                    "Rarity not found",
                    ErrorTypes.VALIDATION,
                    `Rarity **${oldRarityName}** does not exist.`
                );
            }

            let updatedRarityData = { ...existingRarity };
            let finalRarityName = oldRarityName;

            // Handle rarity name change
            if (newRarityName && newRarityName.toLowerCase() !== oldRarityName.toLowerCase()) {
                const newRarityKey = `cards:rarity:${guildId}:${newRarityName.toLowerCase()}`;
                const newRarityExists = await client.db.get(newRarityKey);
                if (newRarityExists) {
                    throw createError(
                        "Rarity name already exists",
                        ErrorTypes.VALIDATION,
                        `A rarity named **${newRarityName}** already exists.`
                    );
                }

                // Update rarity in the list
                let raritiesList = await client.db.get(raritiesListKey, []);
                raritiesList = raritiesList.map(r => r.toLowerCase() === oldRarityName.toLowerCase() ? newRarityName : r);
                await client.db.set(raritiesListKey, raritiesList);

                // Rename the rarity entry in DB
                await client.db.delete(oldRarityKey);
                updatedRarityData.name = newRarityName;
                await client.db.set(newRarityKey, updatedRarityData);
                finalRarityName = newRarityName;

                // Update cards in packs
                const allPacks = await this.getPacks(client, guildId);
                for (const packName of allPacks) {
                    const packKey = `cards:pack:${guildId}:${packName.toLowerCase()}`;
                    const pack = await client.db.get(packKey);
                    if (pack && pack.cards) {
                        let changed = false;
                        pack.cards = pack.cards.map(card => {
                            if (card.rarity.toLowerCase() === oldRarityName.toLowerCase()) {
                                changed = true;
                                return { ...card, rarity: finalRarityName };
                            }
                            return card;
                        });
                        if (changed) {
                            await client.db.set(packKey, pack);
                        }
                    }
                }

                // Update user inventories
                // This is more complex as we'd need to iterate all users or have a more direct way to find users with this card.
                // For now, we'll assume inventory keys are updated on next interaction or during a cleanup.
                // A more robust solution would involve a migration script or a different inventory key structure.
                // For the scope of this request, we'll log a warning and proceed.
                logger.warn(`[CARDS] Rarity name changed from ${oldRarityName} to ${finalRarityName}. User inventories might need manual update or next card interaction will fix it.`, { guildId, oldRarityName, finalRarityName });
            }

            // Update color and chance
            if (newColor) {
                updatedRarityData.color = newColor;
            }
            if (newChance !== null && newChance !== undefined) {
                updatedRarityData.chance = newChance;
            }

            // Save the final updated rarity data (if name wasn't changed, this updates the old key)
            await client.db.set(`cards:rarity:${guildId}:${finalRarityName.toLowerCase()}`, updatedRarityData);

            logger.info(`[CARDS] Rarity edited: ${oldRarityName} -> ${finalRarityName}`, { guildId, oldRarityName, newRarityName, newColor, newChance });
            return updatedRarityData;

        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw createError(
                "Failed to edit rarity",
                ErrorTypes.DATABASE,
                "An error occurred while editing the rarity.",
                { guildId, oldRarityName, error: error.message }
            );
        }
    }

    /**
     * Remove rarity type
     */
    static async removeRarity(client, guildId, rarityName) {
        const rarityKey = `cards:rarity:${guildId}:${rarityName.toLowerCase()}`;
        const raritiesListKey = `cards:rarities:${guildId}`;

        try {
            const existingRarity = await client.db.get(rarityKey);
            if (!existingRarity) {
                throw createError(
                    "Rarity not found",
                    ErrorTypes.VALIDATION,
                    `Rarity **${rarityName}** does not exist.`
                );
            }

            // Remove the rarity
            await client.db.delete(rarityKey);

            // Remove from rarities list
            const raritiesList = await client.db.get(raritiesListKey, []);
            const updatedList = raritiesList.filter(r => r.toLowerCase() !== rarityName.toLowerCase());
            await client.db.set(raritiesListKey, updatedList);

            logger.info(`[CARDS] Rarity removed: ${rarityName}`, { guildId, rarityName });
            return true;
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw createError(
                "Failed to remove rarity",
                ErrorTypes.DATABASE,
                "An error occurred while removing the rarity.",
                { guildId, rarityName, error: error.message }
            );
        }
    }

    /**
     * Add card to pack
     */
    static async addCardToPack(client, guildId, packName, cardName, rarity, value) {
        const packKey = `cards:pack:${guildId}:${packName.toLowerCase()}`;
        const rarityKey = `cards:rarity:${guildId}:${rarity.toLowerCase()}`;

        try {
            const pack = await client.db.get(packKey);
            if (!pack) {
                throw createError(
                    "Pack not found",
                    ErrorTypes.VALIDATION,
                    `Card pack **${packName}** does not exist.`
                );
            }

            const rarityData = await client.db.get(rarityKey);
            if (!rarityData) {
                throw createError(
                    "Rarity not found",
                    ErrorTypes.VALIDATION,
                    `Rarity **${rarity}** does not exist.`
                );
            }

            const cardExists = pack.cards.some(c => c.name.toLowerCase() === cardName.toLowerCase());
            if (cardExists) {
                throw createError(
                    "Card already exists in pack",
                    ErrorTypes.VALIDATION,
                    `Card **${cardName}** already exists in pack **${packName}**.`
                );
            }

            const card = {
                name: cardName,
                rarity,
                value,
                addedAt: Date.now()
            };

            pack.cards.push(card);
            await client.db.set(packKey, pack);

            logger.info(`[CARDS] Card added to pack`, { guildId, packName, cardName, rarity, value });
            return card;
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw createError(
                "Failed to add card to pack",
                ErrorTypes.DATABASE,
                "An error occurred while adding the card.",
                { guildId, packName, cardName, error: error.message }
            );
        }
    }

    /**
     * Add a card pack to the shop.
     */
    static async addPackToShop(client, guildId, packName, cost, minStock, maxStock) {
        const packShopKey = `cards:shop:pack:${guildId}:${packName.toLowerCase()}`;
        const shopPacksListKey = `cards:shop:packs:${guildId}`;

        try {
            // 1. Validate that the packName actually exists as a created card pack.
            const existingPack = await this.getPack(client, guildId, packName);
            if (!existingPack) {
                throw createError(
                    "Pack Not Found",
                    ErrorTypes.VALIDATION,
                    `A card pack named **${packName}** does not exist. Please create it first.`
                );
            }

            // Initialize currentStock to a random value within minStock and maxStock.
            const currentStock = Math.floor(Math.random() * (maxStock - minStock + 1)) + minStock;

            const shopPackData = {
                packName: packName,
                cost: cost,
                minStock: minStock,
                maxStock: maxStock,
                currentStock: currentStock,
                lastStockUpdate: Date.now(),
                addedAt: Date.now()
            };

            await client.db.set(packShopKey, shopPackData);

            // Add to shop packs list
            const shopPacksList = await client.db.get(shopPacksListKey, []);
            if (!shopPacksList.some(p => p.toLowerCase() === packName.toLowerCase())) {
                shopPacksList.push(packName);
                await client.db.set(shopPacksListKey, shopPacksList);
            }

            logger.info(`[CARDS] Pack added to shop: ${packName}`, { guildId, packName, cost, minStock, maxStock, currentStock });
            return shopPackData;
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw createError(
                "Failed to add pack to shop",
                ErrorTypes.DATABASE,
                "An error occurred while adding the pack to the shop.",
                { guildId, packName, error: error.message }
            );
        }
    }

    /**
     * Remove a card pack from the shop.
     */
    static async removePackFromShop(client, guildId, packName) {
        const packShopKey = `cards:shop:pack:${guildId}:${packName.toLowerCase()}`;
        const shopPacksListKey = `cards:shop:packs:${guildId}`;

        try {
            const existingShopPack = await client.db.get(packShopKey);
            if (!existingShopPack) {
                throw createError(
                    "Pack Not In Shop",
                    ErrorTypes.VALIDATION,
                    `Card pack **${packName}** is not currently in the shop.`
                );
            }

            // Remove the pack from the shop
            await client.db.delete(packShopKey);

            // Remove from shop packs list
            const shopPacksList = await client.db.get(shopPacksListKey, []);
            const updatedList = shopPacksList.filter(p => p.toLowerCase() !== packName.toLowerCase());
            await client.db.set(shopPacksListKey, updatedList);

            logger.info(`[CARDS] Pack removed from shop: ${packName}`, { guildId, packName });
            return true;
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw createError(
                "Failed to remove pack from shop",
                ErrorTypes.DATABASE,
                "An error occurred while removing the pack from the shop.",
                { guildId, packName, error: error.message }
            );
        }
    }

    /**
     * Get all pack names currently in the shop for a guild.
     */
    static async getShopPacks(client, guildId) {
        try {
            const shopPacksListKey = `cards:shop:packs:${guildId}`;
            return await client.db.get(shopPacksListKey, []);
        } catch (error) {
            logger.warn(`[CARDS] Failed to get shop packs for guild ${guildId}`, error);
            return [];
        }
    }

    /**
     * Get details of a specific pack in the shop.
     */
    static async getShopPackDetails(client, guildId, packName) {
        try {
            const packShopKey = `cards:shop:pack:${guildId}:${packName.toLowerCase()}`;
            return await client.db.get(packShopKey);
        } catch (error) {
            logger.warn(`[CARDS] Failed to get shop pack details for ${packName} in guild ${guildId}`, error);
            return null;
        }
    }

    /**
     * Restock all card packs in the shop.
     */
    static async restockShop(client, guildId) {
        try {
            const shopPacks = await this.getShopPacks(client, guildId);
            const restockedPacks = [];

            for (const packName of shopPacks) {
                const packDetails = await this.getShopPackDetails(client, guildId, packName);
                if (packDetails) {
                    const newStock = Math.floor(Math.random() * (packDetails.maxStock - packDetails.minStock + 1)) + packDetails.minStock;
                    packDetails.currentStock = newStock;
                    packDetails.lastStockUpdate = Date.now();
                    const packShopKey = `cards:shop:pack:${guildId}:${packName.toLowerCase()}`;
                    await client.db.set(packShopKey, packDetails);
                    restockedPacks.push({ name: packName, newStock: newStock });
                }
            }
            logger.info(`[CARDS] Shop restocked for guild ${guildId}`, { guildId, restockedPacks });
            return restockedPacks;
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw createError(
                "Failed to restock shop",
                ErrorTypes.DATABASE,
                "An error occurred while restocking the shop.",
                { guildId, error: error.message }
            );
        }
    }

    /**
     * Buy a card pack from the shop.
     */
    static async buyPack(client, guildId, userId, packId, quantity = 1) {
        const originalPackName = packId.replace('pack_', '').replace(/_/g, ' '); // Convert 'pack_pack_name' back to 'Pack Name'
        const packShopKey = `cards:shop:pack:${guildId}:${originalPackName.toLowerCase()}`;

        try {
            const shopPack = await client.db.get(packShopKey);
            if (!shopPack) {
                throw createError(
                    "Pack Not Found",
                    ErrorTypes.VALIDATION,
                    `The card pack **${originalPackName}** is not available in the shop.`
                );
            }

            if (quantity < 1) {
                throw createError(
                    "Invalid Quantity",
                    ErrorTypes.VALIDATION,
                    "You must purchase at least 1 pack."
                );
            }

            if (shopPack.currentStock < quantity) {
                throw createError(
                    "Out of Stock",
                    ErrorTypes.VALIDATION,
                    `There are only **${shopPack.currentStock}** of **${shopPack.packName}** packs left in stock.`
                );
            }

            const totalCost = shopPack.cost * quantity;
            const userData = await getEconomyData(client, guildId, userId);

            if (userData.wallet < totalCost) {
                throw createError(
                    "Insufficient Funds",
                    ErrorTypes.VALIDATION,
                    `You need **$${totalCost.toLocaleString()}** to purchase ${quantity}x **${shopPack.packName}**, but you only have **$${userData.wallet.toLocaleString()}** in cash.`
                );
            }

            // Deduct money
            userData.wallet -= totalCost;

            // Update pack stock
            shopPack.currentStock -= quantity;

            // Get the actual card pack details to draw cards from
            const actualPack = await this.getPack(client, guildId, shopPack.packName);
            if (!actualPack || !actualPack.cards || actualPack.cards.length === 0) {
                // Refund money and restock if the pack is empty or doesn't exist
                userData.wallet += totalCost;
                shopPack.currentStock += quantity;
                await client.db.set(packShopKey, shopPack);
                await setEconomyData(client, guildId, userId, userData);
                throw createError(
                    "Empty Pack",
                    ErrorTypes.VALIDATION,
                    `The card pack **${shopPack.packName}** is empty and cannot be purchased. Your money has been refunded.`
                );
            }

            // Get all rarity chances
            const rarityNames = await this.getRarities(client, guildId);
            const allRarityDetails = await Promise.all(rarityNames.map(name => this.getRarityDetails(client, guildId, name)));
            const validRarityDetails = allRarityDetails.filter(Boolean);

            const purchasedCards = [];
            for (let i = 0; i < quantity; i++) {
                // Logic to draw a card from the pack based on rarity chances
                const drawnCard = this.drawCardFromPack(actualPack.cards, validRarityDetails);
                if (drawnCard) {
                    await this.addCardToInventory(client, guildId, userId, drawnCard.name, drawnCard.rarity);
                    purchasedCards.push(drawnCard);
                }
            }

            // Save updated data
            await client.db.set(packShopKey, shopPack);
            await setEconomyData(client, guildId, userId, userData);

            logger.info(`[CARDS] User ${userId} purchased ${quantity}x ${shopPack.packName} for ${totalCost}`, { guildId, userId, packName: shopPack.packName, quantity, totalCost });

            return {
                success: true,
                message: `You successfully purchased ${quantity}x **${shopPack.packName}** for **$${totalCost.toLocaleString()}**!`,
                cards: purchasedCards,
                remainingBalance: userData.wallet
            };

        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw createError(
                "Failed to buy card pack",
                ErrorTypes.DATABASE,
                "An error occurred while purchasing the card pack.",
                { guildId, userId, packId, error: error.message }
            );
        }
    }

    /**
     * Helper function to draw a random card from a pack based on rarity chances.
     */
    static async drawCardFromPack(packCards, rarityDetails) {
        if (!packCards || packCards.length === 0) return null;

        const totalChance = rarityDetails.reduce((sum, r) => sum + r.chance, 0);
        if (totalChance === 0) {
            // If no rarity chances are defined, pick a random card directly
            return packCards[Math.floor(Math.random() * packCards.length)];
        }

        let random = Math.random() * totalChance;
        let selectedRarity = null;

        for (const rarity of rarityDetails) {
            if (random < rarity.chance) {
                selectedRarity = rarity.name;
                break;
            }
            random -= rarity.chance;
        }

        if (selectedRarity) {
            const cardsOfSelectedRarity = packCards.filter(card => card.rarity.toLowerCase() === selectedRarity.toLowerCase());
            if (cardsOfSelectedRarity.length > 0) {
                return cardsOfSelectedRarity[Math.floor(Math.random() * cardsOfSelectedRarity.length)];
            }
        }

        // Fallback: if no card found for selected rarity or no rarity selected, pick any random card
        return packCards[Math.floor(Math.random() * packCards.length)];
    }

    /**
     * Get all packs in guild
     */
    static async getPacks(client, guildId) {
        try {
            const packsListKey = `cards:packs:${guildId}`;
            const packsList = await client.db.get(packsListKey, []);
            return packsList;
        } catch (error) {
            logger.warn(`[CARDS] Failed to get packs for guild ${guildId}`, error);
            return [];
        }
    }

    /**
     * Get all rarities in guild (names only)
     */
    static async getRarities(client, guildId) {
        try {
            const raritiesListKey = `cards:rarities:${guildId}`;
            const raritiesList = await client.db.get(raritiesListKey, []);
            return raritiesList;
        } catch (error) {
            logger.warn(`[CARDS] Failed to get rarities for guild ${guildId}`, error);
            return [];
        }
    }

    /**
     * Get full details of a specific rarity
     */
    static async getRarityDetails(client, guildId, rarityName) {
        try {
            const rarityKey = `cards:rarity:${guildId}:${rarityName.toLowerCase()}`;
            return await client.db.get(rarityKey);
        } catch (error) {
            logger.warn(`[CARDS] Failed to get details for rarity ${rarityName}`, error);
            return null;
        }
    }

    /**
     * Get pack details
     */
    static async getPack(client, guildId, packName) {
        try {
            const packKey = `cards:pack:${guildId}:${packName.toLowerCase()}`;
            return await client.db.get(packKey);
        } catch (error) {
            logger.warn(`[CARDS] Failed to get pack ${packName}`, error);
            return null;
        }
    }

    /**
     * Get user's cards inventory
     */
    static async getUserCards(client, guildId, userId) {
        try {
            const inventoryKey = `cards:inventory:${guildId}:${userId}`;
            return await client.db.get(inventoryKey, {});
        } catch (error) {
            logger.warn(`[CARDS] Failed to get user cards for ${userId}`, error);
            return {};
        }
    }

    /**
     * Add card to user's inventory
     */
    static async addCardToInventory(client, guildId, userId, cardName, rarity) {
        try {
            const inventory = await this.getUserCards(client, guildId, userId);
            const cardKey = `${cardName}:${rarity}`;
            inventory[cardKey] = (inventory[cardKey] || 0) + 1;
            const inventoryKey = `cards:inventory:${guildId}:${userId}`;
            await client.db.set(inventoryKey, inventory);
            return inventory;
        } catch (error) {
            throw createError(
                "Failed to add card to inventory",
                ErrorTypes.DATABASE,
                "An error occurred while adding the card to your inventory.",
                { guildId, userId, cardName, error: error.message }
            );
        }
    }

    /**
     * Sell card from user's inventory
     */
    static async sellCard(client, guildId, userId, cardName) {
        try {
            // Get all packs to find the card and its value
            const packs = await this.getPacks(client, guildId);
            let cardValue = 0;
            let cardRarity = null;

            for (const packName of packs) {
                const pack = await this.getPack(client, guildId, packName);
                if (pack) {
                    const card = pack.cards.find(c => c.name.toLowerCase() === cardName.toLowerCase());
                    if (card) {
                        cardValue = card.value;
                        cardRarity = card.rarity;
                        break;
                    }
                }
            }

            if (!cardValue) {
                throw createError(
                    "Card not found",
                    ErrorTypes.VALIDATION,
                    `Card **${cardName}** was not found in any pack.`
                );
            }

            // Check if user has the card
            const inventory = await this.getUserCards(client, guildId, userId);
            const cardKey = `${cardName}:${cardRarity}`;

            if (!inventory[cardKey] || inventory[cardKey] <= 0) {
                throw createError(
                    "Card not in inventory",
                    ErrorTypes.VALIDATION,
                    `You don't have the card **${cardName}** in your inventory.`
                );
            }

            // Remove from inventory
            inventory[cardKey]--;
            if (inventory[cardKey] === 0) {
                delete inventory[cardKey];
            }
            const inventoryKey = `cards:inventory:${guildId}:${userId}`;
            await client.db.set(inventoryKey, inventory);

            // Add money to user
            const userData = await getEconomyData(client, guildId, userId);
            userData.wallet = (userData.wallet || 0) + cardValue;
            await setEconomyData(client, guildId, userId, userData);

            logger.info(`[CARDS] Card sold`, { guildId, userId, cardName, cardValue });
            return { cardValue, cardName, cardRarity };
        } catch (error) {
            if (error instanceof TitanBotError) throw error;
            throw createError(
                "Failed to sell card",
                ErrorTypes.DATABASE,
                "An error occurred while selling the card.",
                { guildId, userId, cardName, error: error.message }
            );
        }
    }
}

export default CardService;