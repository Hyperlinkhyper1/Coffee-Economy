import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { updateGuildConfig } from '../../services/guildConfig.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed } from '../../utils/embeds.js';

export default {
    data: new SlashCommandBuilder()
        .setName('lotteryalert')
        .setDescription('Change the channel for lottery result alerts')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send lottery win alerts to')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    execute: withErrorHandling(async (interaction, config, client) => {
        await InteractionHelper.safeDefer(interaction);
        
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guildId;

        await updateGuildConfig(client, guildId, { lotteryChannelId: channel.id });

        const embed = successEmbed(
            `Lottery results will now be announced in ${channel}.`,
            "Lottery Alert Channel Updated"
        );

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed]
        });
    }, { command: 'lotteryalert' })
};
