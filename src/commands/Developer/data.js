import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('data')
        .setDescription('Developer-only command to view various bot data.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Placeholder for dev-only access
    // A more robust "dev-only" check would involve checking against a list of specific user IDs or a dedicated developer role.

    async execute(interaction, config, client) {
        // Corrected call to safeDefer: pass an object { ephemeral: true }
        const deferred = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
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

        const embed = createEmbed({
            title: '📊 Bot Data Explorer (Developer Only)',
            description: 'Select a category below to view detailed bot data.',
            color: '#FFD700' // Gold color for dev command
        });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('data_packs')
                    .setLabel('📦 Packs')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('data_jobs')
                    .setLabel('💼 Jobs')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('data_achievements')
                    .setLabel('🏆 Achievements')
                    .setStyle(ButtonStyle.Primary),
            );

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed],
            components: [row],
            ephemeral: true // Keep the reply ephemeral
        });
    },
};