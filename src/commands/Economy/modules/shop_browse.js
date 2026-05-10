import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder, MessageFlags } from 'discord.js';
import { shopItems } from '../../../config/shop/items.js';
import { getColor } from '../../../config/bot.js';
import { logger } from '../../../utils/logger.js';
import CardService from '../../../services/cardService.js'; // Import CardService

export default {
    async execute(interaction, config, client) {
        try {
            // Filter out unpurchasable static items
            const staticBuyableItems = shopItems.filter(item => item.purchasable !== false);

            // Fetch dynamic card packs from the shop
            const shopPackNames = await CardService.getShopPacks(client, interaction.guildId);
            const dynamicCardPacks = [];

            for (const packName of shopPackNames) {
                const packDetails = await CardService.getShopPackDetails(client, interaction.guildId, packName);
                if (packDetails) {
                    dynamicCardPacks.push({
                        id: `pack_${packDetails.packName.toLowerCase().replace(/\s/g, '_')}`, // Unique ID for card packs
                        name: `${packDetails.packName} Card Pack`,
                        emoji: '🃏',
                        price: packDetails.cost,
                        description: `Contains a random selection of cards.`,
                        type: 'card_pack',
                        purchasable: packDetails.currentStock > 0,
                        currentStock: packDetails.currentStock,
                        maxStock: packDetails.maxStock,
                        originalPackName: packDetails.packName // Store original name for potential future use
                    });
                }
            }

            // Combine static and dynamic items
            const allShopItems = [...staticBuyableItems, ...dynamicCardPacks];

            const TARGET_MAX_PAGES = 3;
            const ITEMS_PER_PAGE = Math.max(1, Math.ceil(allShopItems.length / TARGET_MAX_PAGES));
            const totalPages = Math.max(1, Math.ceil(allShopItems.length / ITEMS_PER_PAGE));
            let currentPage = 1;

            if (allShopItems.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🛒 Store')
                    .setColor(getColor('primary'))
                    .setDescription('The shop is currently empty. Check back later!');
                return await interaction.reply({ embeds: [embed], flags: 0 });
            }

            const createShopEmbed = (page) => {
                const startIndex = (page - 1) * ITEMS_PER_PAGE;
                const pageItems = allShopItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
                const embed = new EmbedBuilder()
                    .setTitle('🛒 Store')
                    .setColor(getColor('primary'))
                    .setDescription('Use `/buy item_id:<id> quantity:<amount>` to purchase an item.');

                pageItems.forEach(item => {
                    let valueDescription = `🏷️ **Type:** ${item.type}\n`;
                    if (item.price !== undefined) {
                        valueDescription += `💚 **Price:** $${item.price.toLocaleString()}\n`;
                    } else {
                        valueDescription += `💚 **Price:** Not for sale\n`;
                    }

                    if (item.type === 'card_pack') {
                        valueDescription += `📦 **Stock:** ${item.currentStock}/${item.maxStock}\n`;
                        if (item.currentStock === 0) {
                            valueDescription += `*Currently out of stock.*\n`;
                        }
                    }
                    valueDescription += item.description;

                    embed.addFields({
                        name: `${item.emoji} ${item.name} (${item.id})`,
                        value: valueDescription,
                        inline: false,
                    });
                });
                embed.setFooter({ text: `Page ${page}/${totalPages}` });
                return embed;
            };

            const createShopComponents = (page) => {
                if (totalPages <= 1) return [];
                return [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('shop_prev')
                            .setLabel('⬅️ Previous')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(page === 1),
                        new ButtonBuilder()
                            .setCustomId('shop_next')
                            .setLabel('Next ➡️')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(page === totalPages),
                    ),
                ];
            };

            const message = await interaction.reply({
                embeds: [createShopEmbed(currentPage)],
                components: createShopComponents(currentPage),
                flags: 0,
            });

            const collector = message.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 300000,
            });

            collector.on('collect', async (buttonInteraction) => {
                if (buttonInteraction.user.id !== interaction.user.id) {
                    await buttonInteraction.reply({ content: '❌ You cannot use these buttons. Run `/shop browse` to get your own shop view.', flags: 64 });
                    return;
                }
                const { customId } = buttonInteraction;
                if (customId === 'shop_prev' || customId === 'shop_next') {
                    await buttonInteraction.deferUpdate();
                    if (customId === 'shop_prev' && currentPage > 1) currentPage--;
                    else if (customId === 'shop_next' && currentPage < totalPages) currentPage++;
                    await buttonInteraction.editReply({
                        embeds: [createShopEmbed(currentPage)],
                        components: createShopComponents(currentPage),
                    });
                }
            });

            collector.on('end', async () => {
                try {
                    const disabledComponents = createShopComponents(currentPage);
                    disabledComponents.forEach(row => row.components.forEach(btn => btn.setDisabled(true)));
                    await message.edit({ components: disabledComponents });
                } catch (_) {}
            });
        } catch (error) {
            logger.error('shop_browse error:', error);
            await interaction.reply({ content: '❌ An error occurred while loading the shop.', flags: MessageFlags.Ephemeral });
        }
    },
};
