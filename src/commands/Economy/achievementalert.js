import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import { getLevelingConfig, saveLevelingConfig } from '../../services/leveling.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed } from '../../utils/embeds.js';

export default {
    data: new SlashCommandBuilder()
        .setName('achievementalert')
        .setDescription('Change the channel for achievement alerts')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send achievement alerts to')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    execute: withErrorHandling(async (interaction, config, client) => {
        await InteractionHelper.safeDefer(interaction);
        
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guildId;

        const levelingConfig = await getLevelingConfig(client, guildId);
        levelingConfig.achievementChannel = channel.id;
        
        await saveLevelingConfig(client, guildId, levelingConfig);

        const embed = successEmbed(
            `Achievement alerts will now be sent to ${channel}.`,
            "Achievement Alert Channel Updated"
        );

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed]
        });
    }, { command: 'achievementalert' })
};
