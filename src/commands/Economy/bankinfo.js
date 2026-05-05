import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getEconomyData, getMaxBankCapacity } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('bankinfo')
        .setDescription("View a user's cash and bank balance")
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to check')
                .setRequired(false)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;
            
        const targetUser = interaction.options.getUser("user") || interaction.user;
        const guildId = interaction.guildId;

        if (targetUser.bot) {
            throw createError(
                "Bot user queried",
                ErrorTypes.VALIDATION,
                "Bots do not have economy data."
            );
        }

        const userData = await getEconomyData(client, guildId, targetUser.id);
        
        if (!userData) {
            throw createError(
                "Failed to load data",
                ErrorTypes.DATABASE,
                "Failed to load economy data for this user.",
                { userId: targetUser.id, guildId }
            );
        }

        const maxBank = getMaxBankCapacity(userData);
        const wallet = userData.wallet || 0;
        const bank = userData.bank || 0;

        const embed = createEmbed({
            title: `🏦 Bank Info: ${targetUser.username}`,
            description: `Financial breakdown for ${targetUser}.`,
        })
            .addFields(
                {
                    name: "💵 Cash Balance",
                    value: `$${wallet.toLocaleString()}`,
                    inline: true,
                },
                {
                    name: "🏦 Bank Balance",
                    value: `$${bank.toLocaleString()} / $${maxBank.toLocaleString()}`,
                    inline: true,
                },
                {
                    name: "💎 Total Net Worth",
                    value: `$${(wallet + bank).toLocaleString()}`,
                    inline: true,
                }
            )
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'bankinfo' })
};
