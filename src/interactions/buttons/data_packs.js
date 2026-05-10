import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import CardService from '../../services/cardService.js';

export default {
    name: 'data_packs',
    async execute(interaction, client) {
        const deferred = await InteractionHelper.safeDefer(interaction, true); // Ephemeral reply
        if (!deferred) return;

        // More specific dev check (example - replace with actual dev IDs)
        const DEVELOPER_IDS = ['YOUR_DEV_ID_1', 'YOUR_DEV_ID_2']; // Replace with actual developer user IDs
        if (!DEVELOPER_IDS.includes(interaction.user.id) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            throw createError(
                "Insufficient permissions",
                ErrorTypes.VALIDATION,
                "This command is restricted to developers only."
            );
        }

        try {
            const guildId = interaction.guildId;
            const allPackNames = await CardService.getPacks(client, guildId);

            let packsData = '=== All Card Packs Data ===\n\n';

            if (allPackNames.length === 0) {
                packsData += 'No card packs found.\n';
            } else {
                for (const packName of allPackNames) {
                    const packDetails = await CardService.getPack(client, guildId, packName);
                    if (packDetails) {
                        packsData += `--- Pack: ${packDetails.name} ---\n`;
                        packsData += `  Created At: ${new Date(packDetails.createdAt).toLocaleString()}\n`;
                        packsData += `  Cards (${packDetails.cards.length}):\n`;
                        if (packDetails.cards.length === 0) {
                            packsData += '    (No cards in this pack)\n';
                        } else {
                            packDetails.cards.forEach(card => {
                                packsData += `    - Name: ${card.name}, Rarity: ${card.rarity}, Value: $${card.value.toLocaleString()}\n`;
                            });
                        }
                        packsData += '\n';
                    }
                }
            }

            const fileBuffer = Buffer.from(packsData, 'utf-8');
            const attachment = new AttachmentBuilder(fileBuffer, { name: 'card_packs_data.txt' });

            const embed = createEmbed({
                title: '📦 Card Packs Data',
                description: 'Here is the data for all card packs.',
                color: '#00FF00' // Green for success
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed],
                files: [attachment],
                ephemeral: true
            });

        } catch (error) {
            logger.error('Error generating packs data:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Error', 'An error occurred while generating card packs data.')],
                ephemeral: true
            });
        }
    },
};