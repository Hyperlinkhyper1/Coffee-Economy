import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
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
        ),

    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;

        try {
            if (focusedOption.name === 'packname') {
                const packs = await CardService.getPacks(interaction.client, guildId);
                const filtered = packs.filter(p =>
                    p.toLowerCase().includes(focusedOption.value.toLowerCase())
                );
                await interaction.respond(
                    filtered.slice(0, 25).map(p => ({ name: p, value: p }))
                );
            } else if (focusedOption.name === 'rarity') {
                const rarities = await CardService.getRarities(interaction.client, guildId);
                const filtered = rarities.filter(r =>
                    r.toLowerCase().includes(focusedOption.value.toLowerCase())
                );
                await interaction.respond(
                    filtered.slice(0, 25).map(r => ({ name: r, value: r }))
                );
            } else if (focusedOption.name === 'color') {
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
        if (['createpack', 'addtopack', 'addrarity'].includes(subcommand)) {
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
    }, { command: 'cards' })
};
