import { SlashCommandBuilder } from 'discord.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('codes')
        .setDescription('Manage or view codes')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('View all available reward codes')
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        if (subcommand === 'list') {
            await InteractionHelper.safeDefer(interaction);

            const prefix = `codes:${guildId}:`;
            const keys = await client.db.list(prefix);
            
            if (!keys || keys.length === 0) {
                const embed = createEmbed({
                    title: "🎁 Reward Codes",
                    description: "There are no active reward codes in this server yet.",
                    color: 'info'
                });
                return await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
            }

            const codeList = [];
            for (const key of keys) {
                const codeData = await client.db.get(key);
                if (codeData) {
                    const isRedeemed = codeData.redeemedBy && codeData.redeemedBy.includes(userId);
                    const statusEmoji = isRedeemed ? "✅" : "🎁";
                    const rewards = [];
                    if (codeData.money > 0) rewards.push(`$${codeData.money.toLocaleString()}`);
                    if (codeData.item) rewards.push(codeData.item);
                    
                    const rewardText = rewards.length > 0 ? `(${rewards.join(', ')})` : "";
                    codeList.push(`${statusEmoji} \`${codeData.code}\` ${rewardText}`);
                }
            }

            const embed = createEmbed({
                title: "🎁 Reward Codes",
                description: "Use `/redeem {code}` to claim your rewards!\n\n" + codeList.join('\n'),
                color: 'economy'
            });

            await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
        }
    }, { command: 'codes' })
};
