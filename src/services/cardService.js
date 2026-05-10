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
     * Get all rarities in guild
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

