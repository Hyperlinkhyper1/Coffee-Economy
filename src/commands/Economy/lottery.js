import { SlashCommandBuilder } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed, infoEmbed } from '../../utils/embeds.js';
import { getEconomyData, removeMoney } from '../../utils/economy.js';
import { LotteryService } from '../../services/lotteryService.js';

const LOTTERY_COST = 1000;

export default {
    data: new SlashCommandBuilder()
        .setName('lottery')
        .setDescription('Participate in the hourly lottery')
        .addSubcommand(subcommand =>
            subcommand
                .setName('join')
                .setDescription('Join the current lottery or start a new one (Cost: $1,000)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Check current lottery information')
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        await InteractionHelper.safeDefer(interaction);

        if (subcommand === 'join') {
            const userData = await getEconomyData(client, guildId, userId);
            
            if (userData.wallet < LOTTERY_COST) {
                throw createError(
                    "Insufficient Funds",
                    ErrorTypes.VALIDATION,
                    `You need **$${LOTTERY_COST.toLocaleString()}** in your wallet to join the lottery.`
                );
            }

            let lottery = await LotteryService.getLottery(client, guildId);
            
            if (lottery && lottery.active) {
                const joinResult = await LotteryService.joinLottery(client, guildId, userId);
                if (!joinResult.success) {
                    throw createError("Already Joined", ErrorTypes.VALIDATION, "You are already participating in the current lottery.");
                }
            } else {
                lottery = await LotteryService.startLottery(client, guildId, userId);
            }

            await removeMoney(client, guildId, userId, LOTTERY_COST);

            const embed = successEmbed(
                `You have joined the lottery! **$${LOTTERY_COST.toLocaleString()}** has been deducted from your wallet.\n` +
                `The lottery will end <t:${Math.floor(lottery.endTime / 1000)}:R>.`,
                "🎰 Lottery Joined"
            );
            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        } 
        
        else if (subcommand === 'info') {
            const lottery = await LotteryService.getLottery(client, guildId);
            
            if (!lottery || !lottery.active) {
                const embed = infoEmbed("There is no active lottery. Use `/lottery join` to start one!", "🎰 Lottery Info");
                return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }

            const embed = infoEmbed(
                `**Participants:** ${lottery.participants.length}\n` +
                `**End Time:** <t:${Math.floor(lottery.endTime / 1000)}:F> (<t:${Math.floor(lottery.endTime / 1000)}:R>)\n` +
                `**Cost to Join:** $${LOTTERY_COST.toLocaleString()}`,
                "🎰 Active Lottery"
            );
            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }

    }, { command: 'lottery' })
};
