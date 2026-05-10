import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { shopItems } from '../../config/shop/items.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { getGuildConfig } from '../../services/guildConfig.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { MessageTemplates } from '../../utils/messageTemplates.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import CardService from '../../services/cardService.js'; // Import CardService

const SHOP_ITEMS = shopItems;

export default {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Buy an item from the shop')
        .addStringOption(option =>
            option
                .setName('item_id')
                .setDescription('ID of the item to buy')
                .setRequired(true)
                .setAutocomplete(true) // Enable autocomplete
        )
        .addIntegerOption(option =>
            option
                .setName('quantity')
                .setDescription('Quantity to buy (default: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10)
        ),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const guildId = interaction.guildId;
        const client = interaction.client;

        if (focusedOption.name === 'item_id') {
            const suggestions = [];

            // Add static shop items
            const staticBuyableItems = SHOP_ITEMS.filter(item => item.purchasable !== false);
            staticBuyableItems.forEach(item => {
                suggestions.push({
                    name: `${item.name} ($${item.price.toLocaleString()})`,
                    value: item.id
                });
            });

            // Add dynamic card packs from the shop
            const shopPackNames = await CardService.getShopPacks(client, guildId);
            for (const packName of shopPackNames) {
                const packDetails = await CardService.getShopPackDetails(client, guildId, packName);
                if (packDetails && packDetails.currentStock > 0) {
                    suggestions.push({
                        name: `${packDetails.packName} Card Pack ($${packDetails.cost.toLocaleString()}) - Stock: ${packDetails.currentStock}`,
                        value: `pack_${packDetails.packName.toLowerCase().replace(/\s/g, '_')}`
                    });
                }
            }

            const filtered = suggestions.filter(s =>
                s.name.toLowerCase().includes(focusedOption.value.toLowerCase())
            );

            await interaction.respond(
                filtered.slice(0, 25) // Discord API limit is 25 options
            );
        }
    },

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const itemId = interaction.options.getString("item_id").toLowerCase();
        const quantity = interaction.options.getInteger("quantity") || 1;

        // Check if it's a card pack
        if (itemId.startsWith('pack_')) {
            const buyResult = await CardService.buyPack(client, guildId, userId, itemId, quantity);

            if (buyResult.success) {
                let successDescription = buyResult.message;
                if (buyResult.cards && buyResult.cards.length > 0) {
                    const cardNames = buyResult.cards.map(card => `**${card.name}** (${card.rarity})`).join(', ');
                    successDescription += `\nYou received: ${cardNames}`;
                }

                const embed = successEmbed(
                    "💰 Purchase Successful",
                    successDescription,
                ).addFields({
                    name: "New Balance",
                    value: `$${buyResult.remainingBalance.toLocaleString()}`,
                    inline: true,
                });
                await InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: [MessageFlags.Ephemeral] });
            } else {
                throw createError(
                    "Purchase Failed",
                    ErrorTypes.VALIDATION,
                    buyResult.message
                );
            }
            return; // Exit after handling card pack purchase
        }

        // Existing logic for regular shop items
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) {
            throw createError(
                `Item ${itemId} not found`,
                ErrorTypes.VALIDATION,
                `The item ID \`${itemId}\` does not exist in the shop.`,
                { itemId }
            );
        }

        if (item.purchasable === false) {
            throw createError(
                "Item not purchasable",
                ErrorTypes.VALIDATION,
                `The item **${item.name}** cannot be purchased from the shop.`,
                { itemId }
            );
        }

        if (quantity < 1) {
            throw createError(
                "Invalid quantity",
                ErrorTypes.VALIDATION,
                "You must purchase a quantity of 1 or more.",
                { quantity }
            );
        }

        const totalCost = item.price * quantity;

        const guildConfig = await getGuildConfig(client, guildId);
        const PREMIUM_ROLE_ID = guildConfig.premiumRoleId;

        const userData = await getEconomyData(client, guildId, userId);

        if (userData.wallet < totalCost) {
            throw createError(
                "Insufficient funds",
                ErrorTypes.VALIDATION,
                `You need **$${totalCost.toLocaleString()}** to purchase ${quantity}x **${item.name}**, but you only have **$${userData.wallet.toLocaleString()}** in cash.`,
                { required: totalCost, current: userData.wallet, itemId, quantity }
            );
        }

        if (item.type === "role" && itemId === "premium_role") {
            if (!PREMIUM_ROLE_ID) {
                throw createError(
                    "Premium role not configured",
                    ErrorTypes.CONFIGURATION,
                    "The **Premium Shop Role** has not been configured by a server administrator yet.",
                    { itemId }
                );
            }
            if (interaction.member.roles.cache.has(PREMIUM_ROLE_ID)) {
                throw createError(
                    "Role already owned",
                    ErrorTypes.VALIDATION,
                    `You already have the **${item.name}** role.`,
                    { itemId, roleId: PREMIUM_ROLE_ID }
                );
            }
            if (quantity > 1) {
                throw createError(
                    "Invalid quantity for role",
                    ErrorTypes.VALIDATION,
                    `You can only purchase the **${item.name}** role once.`,
                    { itemId, quantity }
                );
            }
        }

        userData.wallet -= totalCost;

        let successDescription = `You successfully purchased ${quantity}x **${item.name}** for **$${totalCost.toLocaleString()}**!`;

        if (item.type === "role" && itemId === "premium_role") {
            const member = interaction.member;

            const role = interaction.guild.roles.cache.get(PREMIUM_ROLE_ID);

            if (!role) {
                throw createError(
                    "Role not found",
                    ErrorTypes.CONFIGURATION,
                    "The configured premium role no longer exists in this guild.",
                    { roleId: PREMIUM_ROLE_ID }
                );
            }

            try {
                await member.roles.add(
                    role,
                    `Purchased role: ${item.name}`,
                );
                successDescription += `\n\n**👑 The role ${role.toString()} has been granted to you!**`;
            } catch (roleError) {
                userData.wallet += totalCost;
                await setEconomyData(client, guildId, userId, userData);
                throw createError(
                    "Role assignment failed",
                    ErrorTypes.DISCORD_API,
                    "Successfully deducted money, but failed to grant the role. Your cash has been refunded.",
                    { roleId: PREMIUM_ROLE_ID, originalError: roleError.message }
                );
            }
        } else if (item.type === "upgrade") {
            userData.upgrades[itemId] = true;
            successDescription += `\n\n**✨ Your upgrade is now active!**`;
        } else if (item.type === "consumable") {
            userData.inventory[itemId] =
                (userData.inventory[itemId] || 0) + quantity;
        }

        await setEconomyData(client, guildId, userId, userData);

        const embed = successEmbed(
            "💰 Purchase Successful",
            successDescription,
        ).addFields({
            name: "New Balance",
            value: `$${userData.wallet.toLocaleString()}`,
            inline: true,
        });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }, { command: 'buy' })
};