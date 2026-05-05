import { SlashCommandBuilder } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { addMoney, removeMoney, getEconomyData } from '../../utils/economy.js';

export default {
    data: new SlashCommandBuilder()
        .setName('donate')
        .setDescription('Donate money to another user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user you want to donate to')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of money to donate')
                .setRequired(true)
                .setMinValue(1)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        if (targetUser.id === userId) {
            throw createError("Invalid Donation", ErrorTypes.VALIDATION, "You cannot donate money to yourself.");
        }

        if (targetUser.bot) {
            throw createError("Invalid Donation", ErrorTypes.VALIDATION, "You cannot donate money to bots.");
        }

        await InteractionHelper.safeDefer(interaction);

        const userData = await getEconomyData(client, guildId, userId);
        if (userData.wallet < amount) {
            throw createError(
                "Insufficient Funds", 
                ErrorTypes.VALIDATION, 
                `You don't have enough money in your wallet to donate **$${amount.toLocaleString()}**.`
            );
        }

        // Perform the transfer
        await removeMoney(client, guildId, userId, amount);
        await addMoney(client, guildId, targetUser.id, amount);

        const embed = successEmbed(
            `You successfully donated **$${amount.toLocaleString()}** to **${targetUser.username}**!`,
            "💸 Donation Successful"
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    }, { command: 'donate' })
};
