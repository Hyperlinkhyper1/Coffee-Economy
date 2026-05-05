import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from '../../utils/embeds.js';

const CATEGORIES = {
    OVERVIEW: 'overview',
    STATS: 'stats',
    GAMES: 'games',
    ECONOMY: 'economy'
};

export default {
    data: new SlashCommandBuilder()
        .setName('commands')
        .setDescription('List all available commands organized by category'),

    execute: withErrorHandling(async (interaction, config, client) => {
        await InteractionHelper.safeDefer(interaction);

        const initialDisplay = getCategoryDisplay(CATEGORIES.OVERVIEW);
        const response = await InteractionHelper.safeEditReply(interaction, {
            embeds: initialDisplay.embeds,
            components: initialDisplay.components,
            fetchReply: true
        });

        if (!response) return;

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 300000 // 5 minutes
        });

        collector.on('collect', async i => {
            const category = i.customId.replace('cmd_cat_', '');
            const display = getCategoryDisplay(category);
            await i.update({
                embeds: display.embeds,
                components: display.components
            });
        });

        collector.on('end', () => {
            InteractionHelper.safeEditReply(interaction, { components: [] }).catch(() => {});
        });

    }, { command: 'commands' })
};

function getCategoryDisplay(category) {
    let title = "🤖 Bot Commands";
    let description = "Select a category below to view specific commands.";
    let color = 'primary';
    let fields = [];

    switch (category) {
        case CATEGORIES.OVERVIEW:
            description = "Welcome to the command center! Use the buttons below to navigate through different command categories.\n\n" +
                         "📊 **Stats**: Track your progress and rankings.\n" +
                         "🎮 **Games**: Play games and win prizes.\n" +
                         "💰 **Economy**: Manage your wealth and work shifts.";
            break;

        case CATEGORIES.STATS:
            title = "📊 Stats Commands";
            description = "Track your achievements, levels, and bank details.";
            color = 'info';
            fields = [
                { name: '`/achievements`', value: 'View your medals and achievement progress' },
                { name: '`/level`', value: 'Check your current level and experience' },
                { name: '`/leaderboard`', value: 'View the top players in the server' },
                { name: '`/bankinfo`', value: 'Check your cash and bank balance' },
                { name: '`/levelrole`', value: 'Assign a role reward to a specific level (Admin)' },
                { name: '`/levelalert`', value: 'Change the channel for level-up alerts (Admin)' }
            ];
            break;

        case CATEGORIES.GAMES:
            title = "🎮 Game Commands";
            description = "Challenge yourself and others with interactive games.";
            color = 'success';
            fields = [
                { name: '`/hangman`', value: 'Guess the word before the man is hung ($100 to play)' },
                { name: '`/mastermind`', value: 'Guess the secret color code ($100 to play)' },
                { name: '`/coinflip`', value: 'Bet your money on heads or tails' },
                { name: '`/fight`', value: 'Fight another user for a prize' }
            ];
            break;

        case CATEGORIES.ECONOMY:
            title = "💰 Economy Commands";
            description = "Earn, spend, and manage your virtual currency.";
            color = 'economy';
            fields = [
                { name: '`/work`', value: 'Work a shift at your job to earn money' },
                { name: '`/daily`', value: 'Claim your daily cash reward and build a streak' },
                { name: '`/shop`', value: 'Browse and buy items from the shop' },
                { name: '`/pay` / `/donate`', value: 'Transfer money to another user' },
                { name: '`/give`', value: 'Give an item from your inventory to someone' },
                { name: '`/rob`', value: 'Attempt to steal money from another user' },
                { name: '`/redeem`', value: 'Redeem special codes for rewards' },
                { name: '`/lottery`', value: 'Join the server-wide hourly lottery' }
            ];
            break;
    }

    const embed = createEmbed({
        title: title,
        description: description,
        color: color,
        fields: fields
    });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`cmd_cat_${CATEGORIES.OVERVIEW}`)
            .setLabel('Home')
            .setEmoji('🏠')
            .setStyle(2) // Secondary
            .setDisabled(category === CATEGORIES.OVERVIEW),
        new ButtonBuilder()
            .setCustomId(`cmd_cat_${CATEGORIES.STATS}`)
            .setLabel('Stats')
            .setEmoji('📊')
            .setStyle(1) // Primary
            .setDisabled(category === CATEGORIES.STATS),
        new ButtonBuilder()
            .setCustomId(`cmd_cat_${CATEGORIES.GAMES}`)
            .setLabel('Games')
            .setEmoji('🎮')
            .setStyle(3) // Success
            .setDisabled(category === CATEGORIES.GAMES),
        new ButtonBuilder()
            .setCustomId(`cmd_cat_${CATEGORIES.ECONOMY}`)
            .setLabel('Economy')
            .setEmoji('💰')
            .setStyle(1) // Primary
            .setDisabled(category === CATEGORIES.ECONOMY)
    );

    return { embeds: [embed], components: [row] };
}
