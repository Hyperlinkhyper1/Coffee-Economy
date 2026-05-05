import { SlashCommandBuilder } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed } from '../../utils/embeds.js';
import { addMoney } from '../../utils/economy.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('redeem')
        .setDescription('Redeem a reward code')
        .addStringOption(option =>
            option.setName('code')
                .setDescription('The code to redeem')
                .setRequired(true)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        await InteractionHelper.safeDefer(interaction, { ephemeral: true });

        const code = interaction.options.getString('code');
        const codeKey = `codes:${interaction.guildId}:${code}`;
        
        const codeData = await client.db.get(codeKey);

        if (!codeData) {
            throw createError(
                "Invalid Code",
                ErrorTypes.VALIDATION,
                `The code \`${code}\` is invalid or has expired.`
            );
        }

        if (codeData.redeemed) {
            throw createError(
                "Code Already Redeemed",
                ErrorTypes.VALIDATION,
                `The code \`${code}\` has already been used.`
            );
        }

        // Grant rewards
        const rewards = [];
        if (codeData.money > 0) {
            const result = await addMoney(client, interaction.guildId, interaction.user.id, codeData.money);
            if (result.success) {
                rewards.push(`💰 **$${codeData.money.toLocaleString()}**`);
            } else {
                throw createError(
                    "Redemption Failed",
                    ErrorTypes.DATABASE,
                    "Failed to add money to your account. Please try again later."
                );
            }
        }

        // Handle item placeholder (coming soon)
        if (codeData.item) {
            rewards.push(`📦 **${codeData.item}** (Feature coming soon)`);
        }

        // Mark as redeemed
        codeData.redeemed = true;
        codeData.redeemerId = interaction.user.id;
        codeData.redeemedAt = Date.now();
        await client.db.set(codeKey, codeData);

        logger.info(`[ECONOMY] Code redeemed: ${code} by ${interaction.user.id} in guild ${interaction.guildId}`);

        const embed = successEmbed(
            `You have successfully redeemed code \`${code}\`!\n\n**Rewards Received:**\n${rewards.join('\n')}`,
            "Code Redeemed"
        );

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
    }, { command: 'redeem' })
};
