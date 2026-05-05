import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('codecreate')
        .setDescription('Create a redeemable code (Server Owner Only)')
        .addStringOption(option =>
            option.setName('code')
                .setDescription('The code to create')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('money')
                .setDescription('Amount of money the code gives')
                .setRequired(false)
                .setMinValue(1)
        )
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The item the code gives (Coming soon)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    execute: withErrorHandling(async (interaction, config, client) => {
        // Only server owner check
        if (interaction.user.id !== interaction.guild.ownerId) {
            throw createError(
                "Insufficient Permissions",
                ErrorTypes.PERMISSION,
                "Only the server owner can use this command."
            );
        }

        await InteractionHelper.safeDefer(interaction, { ephemeral: true });

        const code = interaction.options.getString('code');
        const money = interaction.options.getInteger('money') || 0;
        const item = interaction.options.getString('item');

        const codeKey = `codes:${interaction.guildId}:${code}`;
        
        // Check if code already exists
        const existing = await client.db.get(codeKey);
        if (existing) {
            throw createError(
                "Code Already Exists",
                ErrorTypes.VALIDATION,
                `The code \`${code}\` already exists in this server.`
            );
        }

        const codeData = {
            code,
            money,
            item, // Placeholder for now as shop is empty
            creatorId: interaction.user.id,
            createdAt: Date.now(),
            redeemed: false
        };

        await client.db.set(codeKey, codeData);

        logger.info(`[ECONOMY] Code created: ${code} in guild ${interaction.guildId}`, { money, item });

        const embed = successEmbed(
            `Successfully created code \`${code}\`!\n` +
            (money > 0 ? `💰 Money: $${money.toLocaleString()}\n` : "") +
            (item ? `📦 Item: ${item}` : ""),
            "Code Created"
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'codecreate' })
};
