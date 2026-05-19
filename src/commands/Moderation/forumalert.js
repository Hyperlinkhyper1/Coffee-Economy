import { SlashCommandBuilder, ChannelType, EmbedBuilder } from 'discord.js';
import { logger } from '../../utils/logger.js';
import { forumAlertService } from '../../services/forumAlertService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('forumalert')
        .setDescription('Manages alerts for forum posts.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('subscribe')
                .setDescription('Subscribe to alerts for this forum post.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unsubscribe')
                .setDescription('Unsubscribe from alerts for this forum post.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all forum posts you are subscribed to for alerts.')),
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const { channel, user, options, guild } = interaction;
        const subcommand = options.getSubcommand();

        if (channel.type !== ChannelType.PublicThread && channel.type !== ChannelType.PrivateThread) {
            if (subcommand !== 'list') { // 'list' can be used anywhere to see personal subscriptions
                return interaction.reply({
                    content: 'This command (except for `list`) can only be used within a forum post (thread).',
                    ephemeral: true,
                });
            }
        }

        try {
            let embed = new EmbedBuilder();

            switch (subcommand) {
                case 'subscribe':
                    const subscribed = await forumAlertService.subscribe(user.id, channel.id, guild.id);
                    if (subscribed) {
                        logger.info(`User ${user.tag} subscribed to forum alerts for channel ${channel.name} (${channel.id}).`);
                        embed
                            .setColor('#00FF00')
                            .setTitle('Subscription Confirmed')
                            .setDescription(`You will now receive alerts for this forum post: **${channel.name}**.`);
                    } else {
                        embed
                            .setColor('#FFA500')
                            .setTitle('Already Subscribed')
                            .setDescription(`You are already subscribed to alerts for this forum post: **${channel.name}**.`);
                    }
                    break;

                case 'unsubscribe':
                    const unsubscribed = await forumAlertService.unsubscribe(user.id, channel.id);
                    if (unsubscribed) {
                        logger.info(`User ${user.tag} unsubscribed from forum alerts for channel ${channel.name} (${channel.id}).`);
                        embed
                            .setColor('#FF0000')
                            .setTitle('Unsubscription Confirmed')
                            .setDescription(`You will no longer receive alerts for this forum post: **${channel.name}**.`);
                    } else {
                        embed
                            .setColor('#FFA500')
                            .setTitle('Not Subscribed')
                            .setDescription(`You were not subscribed to alerts for this forum post: **${channel.name}**.`);
                    }
                    break;

                case 'list':
                    const subscriptions = await forumAlertService.listSubscriptions(user.id);

                    if (subscriptions.length > 0) {
                        const subscriptionList = subscriptions.map(sub => `<#${sub.channelId}>`).join('\n');
                        embed
                            .setColor('#00FFFF')
                            .setTitle('Your Forum Alert Subscriptions')
                            .setDescription(`You are subscribed to alerts for the following forum posts:\n${subscriptionList}`);
                    } else {
                        embed
                            .setColor('#FFA500')
                            .setTitle('No Active Subscriptions')
                            .setDescription('You are not currently subscribed to any forum post alerts.');
                    }
                    break;

                default:
                    embed
                        .setColor('#FF0000')
                        .setTitle('Error')
                        .setDescription('Unknown subcommand.');
                    break;
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });

        } catch (error) {
            logger.error(`Failed to handle forumalert command for user ${user.tag} in channel ${channel.id}:`, error);
            await interaction.reply({
                content: 'There was an error trying to process your forum alert request.',
                ephemeral: true,
            });
        }
    },
};