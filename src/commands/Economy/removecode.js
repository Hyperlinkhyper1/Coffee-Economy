import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('removecode')
        .setDescription('Remove a redeemable code')
        .addStringOption(option =>
            option.setName('code')
                .setDescription('The code to remove')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction) {
        try {
            const focusedValue = interaction.options.getFocused().toLowerCase();
            const guildId = interaction.guildId;
            const client = interaction.client;

            const prefix = `codes:${guildId}:`;
            const keys = await client.db.list(prefix);
            
            if (!keys) return await interaction.respond([]);

            const choices = keys.map(key => key.split(':')[2]).filter(Boolean);
            const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue));
            
            await interaction.respond(
                filtered.slice(0, 25).map(choice => ({ name: choice, value: choice }))
            ).catch(() => {});
        } catch (error) {
            logger.error('Error in removecode autocomplete:', error);
            await interaction.respond([]).catch(() => {});
        }
    },

    execute: withErrorHandling(async (interaction, config, client) => {
        await InteractionHelper.safeDefer(interaction, { ephemeral: true });

        const code = interaction.options.getString('code');
        const codeKey = `codes:${interaction.guildId}:${code}`;
        
        const existing = await client.db.get(codeKey);
        if (!existing) {
            throw createError(
                "Code Not Found",
                ErrorTypes.VALIDATION,
                `The code \`${code}\` does not exist.`
            );
        }

        await client.db.delete(codeKey);

        logger.info(`[ECONOMY] Code removed: ${code} by ${interaction.user.id} in guild ${interaction.guildId}`);

        const embed = successEmbed(
            `Successfully removed code \`${code}\`.`,
            "Code Removed"
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'removecode' })
};
