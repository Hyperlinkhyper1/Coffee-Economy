import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { shopItems } from '../../config/shop/items.js';

export default {
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription('Admin: Give an item to a user (spawns the item)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
        
        // Show all items from the shop for admins to spawn
        const choices = shopItems.map(item => ({
            name: `${item.name} (${item.id})`,
            value: item.id
        }));

        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue));
        
        await interaction.respond(
            filtered.slice(0, 25)
        ).catch(() => {});
    },

    execute: withErrorHandling(async (interaction, config, client) => {
        const targetUser = interaction.options.getUser('user');
        const itemId = interaction.options.getString('item');
        const guildId = interaction.guildId;

        if (targetUser.bot) {
            throw createError("Invalid Action", ErrorTypes.VALIDATION, "You cannot give items to bots.");
        }

        await InteractionHelper.safeDefer(interaction);

        const targetData = await getEconomyData(client, guildId, targetUser.id);
        
        const item = shopItems.find(i => i.id === itemId);
        if (!item) {
            throw createError("Item Not Found", ErrorTypes.VALIDATION, "That item does not exist.");
        }

        // Spawn Item for Target
        if (!targetData.inventory) targetData.inventory = {};
        targetData.inventory[itemId] = (targetData.inventory[itemId] || 0) + 1;

        await setEconomyData(client, guildId, targetUser.id, targetData);

        const embed = successEmbed(
            `Successfully spawned 1x **${item.name}** ${item.emoji || ''} for **${targetUser.username}**!`,
            "🎁 Item Spawned"
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    }, { command: 'give' })
};
