import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { getGuildConfig, setGuildConfig } from '../../utils/database.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setsubmit')
        .setDescription('Set the channel where Truth or Dare submissions will be sent.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send submissions to.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),
    category: 'Admin',

    execute: withErrorHandling(async (interaction, config, client) => {
        const channel = interaction.options.getChannel('channel');
        const guildId = interaction.guildId;

        const currentConfig = await getGuildConfig(client, guildId);
        currentConfig.truthOrDareSubmissionsChannelId = channel.id;

        await setGuildConfig(client, guildId, currentConfig);

        const embed = successEmbed(
            '✅ Submission Channel Set',
            `Truth or Dare submissions will now be sent to ${channel.toString()}.`
        );

        return await InteractionHelper.safeReply(interaction, { embeds: [embed] });
    }, { command: 'setsubmit' })
};
