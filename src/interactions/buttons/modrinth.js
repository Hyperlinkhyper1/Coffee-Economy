import { MessageFlags } from 'discord.js';
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

            // Discord message limit is 2000 characters
            const truncatedChangelog = changelog.length > 1950
                ? changelog.substring(0, 1950) + '\n\n... (truncated)'
                : changelog;

            await interaction.reply({
                content: `### 📖 Changelog\n\n${truncatedChangelog}`,
                flags: MessageFlags.Ephemeral
            });

            // Clean up cache after 10 minutes to save memory
            setTimeout(() => {
                changelogCache.delete(customId);
            }, 600000);

            logger.debug(`[MODRINTH] Sent ephemeral changelog for: ${customId}`);
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



