import { SlashCommandBuilder } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { shopItems } from '../../config/shop/items.js';

export default {
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('Give an item from your inventory to another user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user you want to give the item to')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The item you want to give')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const userId = interaction.user.id;
        const guildId = interaction.guildId;
        const client = interaction.client;

        const userData = await getEconomyData(client, guildId, userId);
        const inventory = userData?.inventory || {};

        // Only show items the user actually has
        const choices = Object.entries(inventory)
            .filter(([itemId, quantity]) => quantity > 0)
            .map(([itemId]) => {
                const item = shopItems.find(i => i.id === itemId);
                return item ? { name: item.name, value: item.id } : null;
            })
            .filter(Boolean);

        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue));
        
        await interaction.respond(
            filtered.slice(0, 25)
        ).catch(() => {});
    },

    execute: withErrorHandling(async (interaction, config, client) => {
        const targetUser = interaction.options.getUser('user');
        const itemId = interaction.options.getString('item');
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        if (targetUser.id === userId) {
            throw createError("Invalid Action", ErrorTypes.VALIDATION, "You cannot give items to yourself.");
        }

        if (targetUser.bot) {
            throw createError("Invalid Action", ErrorTypes.VALIDATION, "You cannot give items to bots.");
        }

        await InteractionHelper.safeDefer(interaction);

        const userData = await getEconomyData(client, guildId, userId);
        const targetData = await getEconomyData(client, guildId, targetUser.id);
        
        const item = shopItems.find(i => i.id === itemId);
        if (!item) {
            throw createError("Item Not Found", ErrorTypes.VALIDATION, "That item does not exist.");
        }

        const inventory = userData.inventory || {};
        if (!inventory[itemId] || inventory[itemId] <= 0) {
            throw createError("Missing Item", ErrorTypes.VALIDATION, `You don't have a **${item.name}** to give.`);
        }

        // Handle Transfer
        userData.inventory[itemId] -= 1;
        if (userData.inventory[itemId] === 0) delete userData.inventory[itemId];

        if (!targetData.inventory) targetData.inventory = {};
        targetData.inventory[itemId] = (targetData.inventory[itemId] || 0) + 1;

        await setEconomyData(client, guildId, userId, userData);
        await setEconomyData(client, guildId, targetUser.id, targetData);

        const embed = successEmbed(
            `You gave 1x **${item.name}** ${item.emoji || ''} to **${targetUser.username}**!`,
            "🎁 Item Given"
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    }, { command: 'give' })
};
