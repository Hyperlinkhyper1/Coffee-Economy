import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed } from '../../utils/embeds.js';
import { addMoney } from '../../utils/economy.js';

export default {
    data: new SlashCommandBuilder()
        .setName('addmoney')
        .setDescription('Add money to a user\'s wallet (Admin only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to give money to')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of money to add')
                .setRequired(true)
                .setMinValue(1)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    execute: withErrorHandling(async (interaction, config, client) => {
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const guildId = interaction.guildId;

        if (targetUser.bot) {
            throw createError("Invalid Target", ErrorTypes.VALIDATION, "You cannot add money to bots.");
        }

        await InteractionHelper.safeDefer(interaction);

        const result = await addMoney(client, guildId, targetUser.id, amount, 'wallet');

        if (!result.success) {
            throw createError("Transaction Failed", ErrorTypes.DATABASE, result.error || "Failed to add money to the user.");
        }

        const embed = successEmbed(
            `Successfully added **$${amount.toLocaleString()}** to **${targetUser.username}**'s wallet.`,
            "💰 Money Added"
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    }, { command: 'addmoney' })
};
