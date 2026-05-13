import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { changelogCache } from '../../commands/Admin/modrinthproject.js';

export default {
    name: 'changelog_',
    async execute(interaction, client) {
        try {
            const customId = interaction.customId;
            const changelog = changelogCache.get(customId);

            if (!changelog) {
                logger.warn(`[MODRINTH] Changelog not found for button: ${customId}`);
                await interaction.reply({
                    content: '❌ Changelog data not found. It may have expired.',
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            // Create a modal to display the changelog
            const modal = new ModalBuilder()
                .setCustomId(`changelog_modal_${Date.now()}`)
                .setTitle('📖 Changelog');

            // Truncate changelog to fit in modal (max 4000 chars for text input)
            const truncatedChangelog = changelog.length > 3950
                ? changelog.substring(0, 3950) + '\n\n... (truncated)'
                : changelog;

            const changelogInput = new TextInputBuilder()
                .setCustomId('changelog_text')
                .setLabel('Version Changelog')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(truncatedChangelog)
                .setRequired(false);

            const actionRow = new ActionRowBuilder().addComponents(changelogInput);
            modal.addComponents(actionRow);

            await interaction.showModal(modal);

            // Clean up cache after 10 minutes to save memory
            setTimeout(() => {
                changelogCache.delete(customId);
            }, 600000);

            logger.debug(`[MODRINTH] Displayed changelog modal for: ${customId}`);
        } catch (error) {
            logger.error('[MODRINTH] Error handling changelog button:', error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Failed to display changelog.',
                        flags: MessageFlags.Ephemeral
                    });
                }
            } catch (replyError) {
                logger.warn('[MODRINTH] Could not send error reply to changelog button', replyError);
            }
        }
    }
};



