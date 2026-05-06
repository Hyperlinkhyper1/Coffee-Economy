import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, BANK_UPGRADES } from '../../utils/economy.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('bankupgrade')
        .setDescription('Upgrade your bank capacity'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        const userData = await getEconomyData(client, guildId, userId);

        if (!userData) {
            throw createError(
                "Failed to load economy data",
                ErrorTypes.DATABASE,
                "Failed to load your economy data. Please try again later.",
                { userId, guildId }
            );
        }

        const currentLevel = userData.bankLevel || 0;
        const currentUpgrade = BANK_UPGRADES.find(u => u.level === currentLevel) || BANK_UPGRADES[0];
        const nextLevel = currentLevel + 1;
        const upgrade = BANK_UPGRADES.find(u => u.level === nextLevel);

        if (!upgrade) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    infoEmbed(
                        "Maximum Level Reached",
                        `You have already reached the maximum bank level (**Level ${currentLevel}**).\n` +
                        `Your current capacity is **$${currentUpgrade.capacity.toLocaleString()}**.`
                    )
                ]
            });
        }

        // Add a prompt or detailed info if they are just checking (though this command is meant to perform the action)
        // Since slash commands are direct actions, we'll proceed with the requirement check

        if (userData.wallet < upgrade.cost) {
            return await InteractionHelper.safeEditReply(interaction, {
                embeds: [
                    errorEmbed(
                        `You don't have enough cash to upgrade to **Level ${nextLevel}**.\n` +
                        `Cost: **$${upgrade.cost.toLocaleString()}**\n` +
                        `Missing: **$${(upgrade.cost - userData.wallet).toLocaleString()}**`
                    )
                ]
            });
        }

        // Perform upgrade
        userData.wallet -= upgrade.cost;
        userData.bankLevel = nextLevel;

        await setEconomyData(client, guildId, userId, userData);

        const embed = successEmbed(
            "🏦 Bank Upgraded!",
            `Successfully upgraded your bank to **Level ${nextLevel}**!\n\n` +
            `💰 **Cost Paid:** $${upgrade.cost.toLocaleString()}\n` +
            `📈 **New Capacity:** $${upgrade.capacity.toLocaleString()}`
        );

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed]
        });
    }, { command: 'bankupgrade' })
};
