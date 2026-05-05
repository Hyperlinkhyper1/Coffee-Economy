import { SlashCommandBuilder } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { addMoney, removeMoney, getEconomyData } from '../../utils/economy.js';

export default {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin and bet some money')
        .addStringOption(option =>
            option.setName('choice')
                .setDescription('Heads or Tails')
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of money to bet')
                .setRequired(true)
                .setMinValue(1)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = ['heads', 'tails'];
        const filtered = choices.filter(choice => choice.startsWith(focusedValue));
        await interaction.respond(
            filtered.map(choice => ({ name: choice.charAt(0).toUpperCase() + choice.slice(1), value: choice }))
        ).catch(() => {});
    },

    execute: withErrorHandling(async (interaction, config, client) => {
        const choice = interaction.options.getString('choice').toLowerCase();
        const amount = interaction.options.getInteger('amount');
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        if (!['heads', 'tails'].includes(choice)) {
            throw createError("Invalid Choice", ErrorTypes.VALIDATION, "Please choose either Heads or Tails.");
        }

        await InteractionHelper.safeDefer(interaction);

        const userData = await getEconomyData(client, guildId, userId);
        if (userData.wallet < amount) {
            throw createError(
                "Insufficient Funds", 
                ErrorTypes.VALIDATION, 
                `You don't have enough money in your wallet. You currently have **$${userData.wallet.toLocaleString()}**.`
            );
        }

        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const win = choice === result;

        if (win) {
            await addMoney(client, guildId, userId, amount);
            const embed = successEmbed(
                `The coin landed on **${result.charAt(0).toUpperCase() + result.slice(1)}**!\n` +
                `You won **$${amount.toLocaleString()}**!`,
                "💰 You Won!"
            );
            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } else {
            await removeMoney(client, guildId, userId, amount);
            const embed = errorEmbed(
                `The coin landed on **${result.charAt(0).toUpperCase() + result.slice(1)}**.\n` +
                `You lost **$${amount.toLocaleString()}**.`,
                null,
                { showDetails: true }
            );
            embed.setTitle("💸 You Lost!");
            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

    }, { command: 'coinflip' })
};
