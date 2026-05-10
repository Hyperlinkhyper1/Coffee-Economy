import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed } from '../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import CardService from '../../services/cardService.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';

const TEXT_COLORS = [
    'Black', 'Dark Blue', 'Dark Green', 'Dark Cyan',
    'Dark Red', 'Dark Magenta', 'Dark Yellow', 'Light Gray',
    'Dark Gray', 'Blue', 'Green', 'Cyan', 'Red', 'Magenta', 'Yellow', 'White'
];

const CARDS_PER_PAGE = 10;

async function getCardIndexEmbedAndComponents(client, guildId, page, rarityFilter = 'Common', packNameFilter = null) { // Added packNameFilter
    let allCards = [];

    if (packNameFilter) {
        const pack = await CardService.getPack(client, guildId, packNameFilter);
        if (pack && pack.cards) {
            allCards = pack.cards;
        }
    } else {
        const allPacks = await CardService.getPacks(client, guildId);
        for (const packName of allPacks) {
            const pack = await CardService.getPack(client, guildId, packName);
            if (pack && pack.cards) {
                allCards = allCards.concat(pack.cards);
            }
        }
    }

    let filteredCards = allCards;
    let embedColor = null; // Default color

    if (rarityFilter !== 'all') {
        filteredCards = allCards.filter(card => card.rarity.toLowerCase() === rarityFilter.toLowerCase());
        const rarityDetails = await CardService.getRarityDetails(client, guildId, rarityFilter);
        if (rarityDetails) {
            embedColor = rarityDetails.color; // This will be a string like 'Dark Blue'
        }
    }

    logger.debug(`[CARDS] getCardIndexEmbedAndComponents - embedColor before createEmbed: ${embedColor}`);

    const totalPages = Math.ceil(filteredCards.length / CARDS_PER_PAGE);
    const currentPage = Math.max(0, Math.min(page, totalPages - 1)); // Ensure page is within bounds

    const start = currentPage * CARDS_PER_PAGE;
    const end = start + CARDS_PER_PAGE;
    const cardsToDisplay = filteredCards.slice(start, end);

    const embed = createEmbed({ // Corrected call: pass an object
        title: '💳 Card Index',
        color: embedColor, // Pass color as a property of the object
        description: `Displaying cards (Rarity: ${rarityFilter === 'all' ? 'All' : rarityFilter}${packNameFilter ? ` from pack: ${packNameFilter}` : ''})`,
        footer: { text: `Page ${currentPage + 1} of ${totalPages || 1}` }
    });

    if (cardsToDisplay.length === 0) {
        embed.addFields({ name: 'No Cards Found', value: 'There are no cards to display for this filter.' });
    } else {
        cardsToDisplay.forEach(card => {
            embed.addFields({
                name: card.name,
                value: `Rarity: ${card.rarity} | Value: $${card.value.toLocaleString()}`,
                inline: false
            });
        });
    }

    const rarityNames = await CardService.getRarities(client, guildId); // Get just names
    const allRarityDetails = await Promise.all(rarityNames.map(name => CardService.getRarityDetails(client, guildId, name)));
    const validRarityDetails = allRarityDetails.filter(Boolean); // Filter out nulls

    const rarityOptions = [{ label: 'All Rarities', value: 'all', default: rarityFilter === 'all' }];
    rarityOptions.push(...validRarityDetails.map(r => ({
        label: r.name,
        value: r.name,
        default: rarityFilter.toLowerCase() === r.name.toLowerCase()
    })));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('cardindex_rarity_filter')
        .setPlaceholder('Filter by rarity...')
        .addOptions(rarityOptions.slice(0, 25)); // Discord API limit of 25 options

    // Pass packNameFilter in customId for persistence
    const buttons = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`cardindex_prev_${currentPage}_${rarityFilter}_${packNameFilter || 'none'}`)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`cardindex_next_${currentPage}_${rarityFilter}_${packNameFilter || 'none'}`)
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(currentPage >= totalPages - 1 || totalPages === 0)
        );

    const selectMenuRow = new ActionRowBuilder()
        .addComponents(selectMenu);

    return { embeds: [embed], components: [buttons, selectMenuRow] };
}


export default {
    data: new SlashCommandBuilder()
        .setName('cards')
        .setDescription('Manage card packs and trade cards')
        .addSubcommand(subcommand =>
            subcommand
                .setName('createpack')
                .setDescription('Create a new card pack (Admin only)')
                .addStringOption(option =>
                    option.setName('packname')
                        .setDescription('Name of the pack')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('addtopack')
                .setDescription('Add a card to a pack (Admin only)')
                .addStringOption(option =>
                    option.setName('packname')
                        .setDescription('Pack to add card to')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option.setName('cardname')
                        .setDescription('Name of the card')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('rarity')
                        .setDescription('Card rarity')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addIntegerOption(option =>
                    option.setName('value')
                        .setDescription('Card sell value in money')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('addrarity')
                .setDescription('Add a new rarity type (Admin only)')
                .addStringOption(option =>
                    option.setName('rarityname')
                        .setDescription('Name of the rarity')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Text color for the rarity')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addNumberOption(option =>
                    option.setName('chance')
                        .setDescription('Drop chance percentage (e.g., 2.5, 5, 10)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(100)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('editrarity')
                .setDescription('Edit an existing rarity type (Admin only)')
                .addStringOption(option =>
                    option.setName('rarityname')
                        .setDescription('Current name of the rarity to edit')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addStringOption(option =>
                    option.setName('newrarityname')
                        .setDescription('New name for the rarity (optional)')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('newcolor')
                        .setDescription('New text color for the rarity (optional)')
                        .setRequired(false)
                        .setAutocomplete(true)
                )
                .addNumberOption(option =>
                    option.setName('newchance')
                        .setDescription('New drop chance percentage (e.g., 2.5, 5, 10) (optional)')
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(100)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('removerarity')
                .setDescription('Remove a rarity type (Admin only)')
                .addStringOption(option =>
                    option.setName('rarity')
                        .setDescription('Rarity to remove')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('sellcard')
                .setDescription('Sell a card from your inventory')
                .addStringOption(option =>
                    option.setName('cardname')
                        .setDescription('Card to sell')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('cardindex')
                .setDescription('View all available cards')
                .addStringOption(option =>
                    option.setName('packname')
                        .setDescription('Filter cards by a specific pack')
                        .setRequired(false)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('shopaddpack')
                .setDescription('Add a card pack to the shop (Admin only)')
                .addStringOption(option =>
                    option.setName('packname')
                        .setDescription('Name of the pack to add to the shop')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addIntegerOption(option =>
                    option.setName('cost')
                        .setDescription('Amount of money the pack costs')
                        .setRequired(true)
                        .setMinValue(0)
                )
                .addStringOption(option =>
                    option.setName('stockrange')
                        .setDescription('Stock range (e.g., "0-4", "1-7"). Refreshes every 15 mins.')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('shopremovepack')
                .setDescription('Remove a card pack from the shop (Admin only)')
                .addStringOption(option =>
                    option.setName('packname')
                        .setDescription('Name of the pack to remove from the shop')
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('shoprestock')
                .setDescription('Restock all card packs in the shop immediately (Admin only)')
        ),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        try {
            if (focusedOption.name === 'packname') {
                let packs = [];
                if (['shopaddpack', 'addtopack', 'createpack', 'cardindex'].includes(subcommand)) { // Added 'cardindex'
                    // For adding/creating, suggest all existing packs
                    packs = await CardService.getPacks(interaction.client, guildId);
                } else if (subcommand === 'shopremovepack') {
                    // For removing from shop, suggest only packs currently in the shop
                    packs = await CardService.getShopPacks(interaction.client, guildId);
                } else {
                    packs = await CardService.getPacks(interaction.client, guildId);
                }

                const filtered = packs.filter(p =>
                    p.toLowerCase().includes(focusedOption.value.toLowerCase())
                );
                await interaction.respond(
                    filtered.slice(0, 25).map(p => ({ name: p, value: p }))
                );
            } else if (focusedOption.name === 'rarity' || focusedOption.name === 'rarityname') { // Added rarityname
                const rarities = await CardService.getRarities(interaction.client, guildId);
                const filtered = rarities.filter(r =>
                    r.toLowerCase().includes(focusedOption.value.toLowerCase())
                );
                await interaction.respond(
                    filtered.slice(0, 25).map(r => ({ name: r, value: r }))
                );
            } else if (focusedOption.name === 'color' || focusedOption.name === 'newcolor') { // Added newcolor
                const filtered = TEXT_COLORS.filter(c =>
                    c.toLowerCase().includes(focusedOption.value.toLowerCase())
                );
                await interaction.respond(
                    filtered.slice(0, 25).map(c => ({ name: c, value: c }))
                );
            } else if (focusedOption.name === 'cardname') {
                // Get all cards from all packs
                const packs = await CardService.getPacks(interaction.client, guildId);
                const cards = new Set();

                for (const packName of packs) {
                    const pack = await CardService.getPack(interaction.client, guildId, packName);
                    if (pack && pack.cards) {
                        for (const card of pack.cards) {
                            if (subcommand === 'sellcard') {
                                const inventory = await CardService.getUserCards(
                                    interaction.client,
                                    guildId,
                                    interaction.user.id
                                );
                                const cardKey = `${card.name}:${card.rarity}`;
                                if (inventory[cardKey] && inventory[cardKey] > 0) {
                                    cards.add(card.name);
                                }
                            } else {
                                cards.add(card.name);
                            }
                        }
                    }
                }

                const filtered = Array.from(cards).filter(c =>
                    c.toLowerCase().includes(focusedOption.value.toLowerCase())
                );
                await interaction.respond(
                    filtered.slice(0, 25).map(c => ({ name: c, value: c }))
                );
            }
        } catch (error) {
            logger.warn('[CARDS] Autocomplete error:', error);
            await interaction.respond([]).catch(() => {});
        }
    },

    execute: withErrorHandling(async (interaction, config, client) => {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        // Check admin permissions for admin commands
        if (['createpack', 'addtopack', 'addrarity', 'editrarity', 'removerarity', 'shopaddpack', 'shopremovepack', 'shoprestock'].includes(subcommand)) {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                throw createError(
                    "Insufficient permissions",
                    ErrorTypes.VALIDATION,
                    "You need Administrator permissions to use this command."
                );
            }
        }

        if (subcommand === 'createpack') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const packName = interaction.options.getString('packname');

            const pack = await CardService.createPack(client, guildId, packName);

            const embed = successEmbed(
                "💳 Card Pack Created",
                `Successfully created card pack **${pack.name}**!\n` +
                `You can now add cards to this pack using \`/cards addtopack\`.`
            );

            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        if (subcommand === 'addrarity') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const rarityName = interaction.options.getString('rarityname');
            const color = interaction.options.getString('color');
            const chance = interaction.options.getNumber('chance');

            const rarity = await CardService.addRarity(client, guildId, rarityName, color, chance);

            const embed = successEmbed(
                "⭐ Rarity Created",
                `Successfully created rarity **${rarity.name}**!\n` +
                `**Color:** ${rarity.color}\n` +
                `**Drop Chance:** ${rarity.chance}%`
            );

            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        if (subcommand === 'editrarity') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const rarityName = interaction.options.getString('rarityname');
            const newRarityName = interaction.options.getString('newrarityname');
            const newColor = interaction.options.getString('newcolor');
            const newChance = interaction.options.getNumber('newchance');

            if (!newRarityName && !newColor && newChance === null) {
                throw createError(
                    "No changes specified",
                    ErrorTypes.VALIDATION,
                    "You must provide at least one new value (name, color, or chance) to edit the rarity."
                );
            }

            const updatedRarity = await CardService.editRarity(
                client,
                guildId,
                rarityName,
                newRarityName,
                newColor,
                newChance
            );

            const embed = successEmbed(
                "⭐ Rarity Edited",
                `Successfully updated rarity **${rarityName}**!` +
                `\n**New Name:** ${updatedRarity.name}` +
                `\n**New Color:** ${updatedRarity.color}` +
                `\n**New Drop Chance:** ${updatedRarity.chance}%`
            );

            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        if (subcommand === 'removerarity') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const rarityName = interaction.options.getString('rarity');

            await CardService.removeRarity(client, guildId, rarityName);

            const embed = successEmbed(
                "⭐ Rarity Removed",
                `Successfully removed rarity **${rarityName}**!`
            );

            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        if (subcommand === 'addtopack') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const packName = interaction.options.getString('packname');
            const cardName = interaction.options.getString('cardname');
            const rarity = interaction.options.getString('rarity');
            const value = interaction.options.getInteger('value');

            const card = await CardService.addCardToPack(
                client,
                guildId,
                packName,
                cardName,
                rarity,
                value
            );

            const embed = successEmbed(
                "💳 Card Added",
                `Successfully added **${card.name}** to pack **${packName}**!\n` +
                `**Rarity:** ${card.rarity}\n` +
                `**Sell Value:** $${card.value.toLocaleString()}`
            );

            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        if (subcommand === 'sellcard') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const cardName = interaction.options.getString('cardname');

            const result = await CardService.sellCard(client, guildId, interaction.user.id, cardName);

            const userData = await getEconomyData(client, guildId, interaction.user.id);

            const embed = successEmbed(
                "💳 Card Sold!",
                `You sold **${result.cardName}** (${result.cardRarity}) for **$${result.cardValue.toLocaleString()}**!`
            )
                .addFields({
                    name: "💰 New Balance",
                    value: `$${userData.wallet.toLocaleString()}`,
                    inline: true,
                });

            logger.info(`[CARDS] Card sold by ${interaction.user.id}`, {
                guildId,
                cardName: result.cardName,
                value: result.cardValue
            });

            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        if (subcommand === 'shopaddpack') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const packName = interaction.options.getString('packname');
            const cost = interaction.options.getInteger('cost');
            const stockRange = interaction.options.getString('stockrange');

            // Validate stockRange format (e.g., "0-4")
            const stockRangeRegex = /^(\d+)-(\d+)$/;
            const match = stockRange.match(stockRangeRegex);

            if (!match) {
                throw createError(
                    "Invalid Stock Range",
                    ErrorTypes.VALIDATION,
                    "The stock range must be in the format 'min-max', e.g., '0-4' or '1-7'."
                );
            }

            const minStock = parseInt(match[1]);
            const maxStock = parseInt(match[2]);

            if (minStock > maxStock) {
                throw createError(
                    "Invalid Stock Range",
                    ErrorTypes.VALIDATION,
                    "The minimum stock value cannot be greater than the maximum stock value."
                );
            }

            // Check if the pack exists
            const packExists = await CardService.getPack(client, guildId, packName);
            if (!packExists) {
                throw createError(
                    "Pack Not Found",
                    ErrorTypes.VALIDATION,
                    `A card pack named **${packName}** does not exist. Please create it first.`
                );
            }

            await CardService.addPackToShop(client, guildId, packName, cost, minStock, maxStock);

            const embed = successEmbed(
                "💳 Shop Pack Added",
                `Successfully added card pack **${packName}** to the shop!\n` +
                `**Cost:** $${cost.toLocaleString()}\n` +
                `**Stock Range:** ${minStock}-${maxStock} (refreshes every 15 minutes)`
            );

            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        if (subcommand === 'shopremovepack') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const packName = interaction.options.getString('packname');

            await CardService.removePackFromShop(client, guildId, packName);

            const embed = successEmbed(
                "💳 Shop Pack Removed",
                `Successfully removed card pack **${packName}** from the shop.`
            );

            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        if (subcommand === 'shoprestock') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const restockedPacks = await CardService.restockShop(client, guildId);

            if (restockedPacks.length === 0) {
                const embed = infoEmbed(
                    "💳 Shop Restock",
                    "No card packs found in the shop to restock."
                );
                return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }

            const restockDetails = restockedPacks.map(p => `**${p.name}**: New Stock ${p.newStock}`).join('\n');
            const embed = successEmbed(
                "💳 Shop Restocked!",
                `The following card packs have been restocked:\n${restockDetails}`
            );

            return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

        if (subcommand === 'cardindex') {
            const deferred = await InteractionHelper.safeDefer(interaction);
            if (!deferred) return;

            const packNameFilter = interaction.options.getString('packname'); // Get the packname option

            const { embeds, components } = await getCardIndexEmbedAndComponents(client, guildId, 0, 'Common', packNameFilter); // Changed 'all' to 'Common'
            const reply = await InteractionHelper.safeEditReply(interaction, { embeds, components, fetchReply: true });

            // Create a collector to listen for button and select menu interactions
            const collector = reply.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id && i.customId.startsWith('cardindex_'),
                time: 300000 // 5 minutes
            });

            collector.on('collect', async i => {
                await i.deferUpdate();
                let currentPage = 0;
                let rarityFilter = 'Common'; // Changed 'all' to 'Common'
                let currentPackNameFilter = packNameFilter; // Persist the packNameFilter

                if (i.customId.startsWith('cardindex_prev_') || i.customId.startsWith('cardindex_next_')) {
                    const parts = i.customId.split('_');
                    currentPage = parseInt(parts[2]);
                    rarityFilter = parts[3];
                    currentPackNameFilter = parts[4] === 'none' ? null : parts[4]; // Retrieve packNameFilter

                    if (i.customId.startsWith('cardindex_prev_')) {
                        currentPage--;
                    } else {
                        currentPage++;
                    }
                } else if (i.customId === 'cardindex_rarity_filter') {
                    rarityFilter = i.values[0];
                    currentPage = 0; // Reset to first page when filter changes
                }

                const { embeds: newEmbeds, components: newComponents } = await getCardIndexEmbedAndComponents(client, guildId, currentPage, rarityFilter, currentPackNameFilter);
                await i.editReply({ embeds: newEmbeds, components: newComponents });
            });

            collector.on('end', async () => {
                // Disable components when collector ends
                const disabledComponents = components.map(row => {
                    return new ActionRowBuilder().addComponents(
                        row.components.map(component => {
                            if (component.data.type === 2) { // Button
                                return ButtonBuilder.from(component).setDisabled(true);
                            } else if (component.data.type === 3) { // SelectMenu
                                return StringSelectMenuBuilder.from(component).setDisabled(true);
                            }
                            return component;
                        })
                    );
                });
                await InteractionHelper.safeEditReply(interaction, { components: disabledComponents });
            });
        }
    }, { command: 'cards' })
};