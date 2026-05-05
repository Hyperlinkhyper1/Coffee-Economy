import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed, successEmbed, infoEmbed, errorEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, addMoney, removeMoney } from '../../utils/economy.js';
import { checkAndAnnounceAchievements } from '../../config/achievements.js';

const COST = 100;
const REWARD = 500;
const COOLDOWN = 2 * 60 * 1000; // 2 minutes
const TRIES = 8;
const COLORS = [
    { name: 'Red', emoji: '🔴', id: 'red' },
    { name: 'Blue', emoji: '🔵', id: 'blue' },
    { name: 'Green', emoji: '🟢', id: 'green' },
    { name: 'Yellow', emoji: '🟡', id: 'yellow' },
    { name: 'Purple', emoji: '🟣', id: 'purple' },
    { name: 'Orange', emoji: '🟠', id: 'orange' }
];

export default {
    data: new SlashCommandBuilder()
        .setName('mastermind')
        .setDescription('Play a game of Mastermind for a chance to win money'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        await InteractionHelper.safeDefer(interaction);

        const userData = await getEconomyData(client, guildId, userId);
        const lastPlay = userData.lastMastermind || 0;
        const now = Date.now();

        if (now < lastPlay + COOLDOWN) {
            const remaining = lastPlay + COOLDOWN - now;
            throw createError(
                "Cooldown Active",
                ErrorTypes.RATE_LIMIT,
                `You need to wait **${Math.floor(remaining / 1000)}s** before playing Mastermind again.`
            );
        }

        if (userData.wallet < COST) {
            throw createError(
                "Insufficient Funds",
                ErrorTypes.VALIDATION,
                `You need **$${COST}** to play Mastermind.`
            );
        }

        const startEmbed = infoEmbed(
            "The goal of Mastermind is to guess the exact colors and positions of a secret code.\n\n" +
            "**How to play:**\n" +
            "• Select 4 colors in order.\n" +
            "• A color can be selected more than once.\n" +
            "• Feedback:\n" +
            "  ✅ = Correct color and correct position\n" +
            "  ☑️ = Correct color but wrong position\n" +
            "  ❌ = Wrong color\n\n" +
            `**Cost:** $${COST} | **Reward:** $${REWARD}\n` +
            "Click **Start** below to begin!",
            `🎮 Mastermind - ${interaction.user.username}`
        );

        const startRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mm_start').setLabel('Start Game').setStyle(ButtonStyle.Success)
        );

        const response = await InteractionHelper.safeEditReply(interaction, {
            embeds: [startEmbed],
            components: [startRow],
            fetchReply: true
        });

        if (!response) return;

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 600000 // 10 minutes
        });

        let gameState = 'lobby';
        let secretCode = [];
        let guesses = [];
        let currentGuess = [];
        let feedback = [];

        collector.on('collect', async i => {
            if (i.customId === 'mm_start' && gameState === 'lobby') {
                // Deduct cost and start
                await removeMoney(client, guildId, userId, COST);
                userData.lastMastermind = Date.now();
                await setEconomyData(client, guildId, userId, userData);

                gameState = 'playing';
                secretCode = Array.from({ length: 4 }, () => COLORS[Math.floor(Math.random() * COLORS.length)].id);
                
                await i.update(updateGameDisplay(interaction, guesses, currentGuess, feedback, false));
            } 
            
            else if (i.customId.startsWith('mm_color_') && gameState === 'playing') {
                const colorId = i.customId.replace('mm_color_', '');
                currentGuess.push(colorId);

                if (currentGuess.length === 4) {
                    const result = evaluateGuess(secretCode, currentGuess);
                    guesses.push([...currentGuess]);
                    feedback.push(result);
                    const perfectMatches = result.filter(r => r === '✅').length;
                    currentGuess = [];

                    if (perfectMatches === 4) {
                        gameState = 'won';
                    } else if (guesses.length >= TRIES) {
                        gameState = 'lost';
                    }
                }

                if (gameState === 'won') {
                    await addMoney(client, guildId, userId, REWARD);
                    const updatedData = await getEconomyData(client, guildId, userId);
                    updatedData.stats.mastermindWins = (updatedData.stats.mastermindWins || 0) + 1;
                    await checkAndAnnounceAchievements(client, interaction.guild, interaction.member, updatedData);
                    await setEconomyData(client, guildId, userId, updatedData);
                    
                    await i.update(updateGameDisplay(interaction, guesses, currentGuess, feedback, true, secretCode));
                    collector.stop('game_over');
                } else if (gameState === 'lost') {
                    await i.update(updateGameDisplay(interaction, guesses, currentGuess, feedback, false, secretCode));
                    collector.stop('game_over');
                } else {
                    await i.update(updateGameDisplay(interaction, guesses, currentGuess, feedback, false));
                }
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason !== 'game_over') {
                InteractionHelper.safeEditReply(interaction, { components: [] }).catch(() => {});
            }
        });

    }, { command: 'mastermind' })
};

function evaluateGuess(secret, guess) {
    const results = Array(4).fill('❌');
    const secretCopy = [...secret];
    const guessCopy = [...guess];

    // First pass: Find perfect matches (correct color + position)
    for (let i = 0; i < 4; i++) {
        if (guessCopy[i] === secretCopy[i]) {
            results[i] = '✅';
            secretCopy[i] = null;
            guessCopy[i] = null;
        }
    }

    // Second pass: Find partial matches (correct color + wrong position)
    for (let i = 0; i < 4; i++) {
        if (guessCopy[i] !== null) {
            const index = secretCopy.indexOf(guessCopy[i]);
            if (index !== -1) {
                results[i] = '☑️';
                secretCopy[index] = null;
            }
        }
    }

    return results;
}

function updateGameDisplay(interaction, guesses, currentGuess, feedback, won, secretCode = null) {
    let description = `Lives: **${TRIES - guesses.length}**\n\n`;

    // Show history
    for (let i = 0; i < guesses.length; i++) {
        const guessEmojis = guesses[i].map(id => COLORS.find(c => c.id === id).emoji).join(' ');
        const fb = feedback[i].join(' ');
        description += `${guessEmojis} ➔ ${fb}\n`;
    }

    // Show current progress
    if (secretCode === null) {
        const currentEmojis = currentGuess.map(id => COLORS.find(c => c.id === id).emoji).join(' ');
        const blanks = '❓ '.repeat(4 - currentGuess.length);
        description += `${currentEmojis}${blanks}\n`;
    }

    const embed = createEmbed({
        title: `🎮 Mastermind - ${interaction.user.username}`,
        description: description,
        color: won ? 'success' : (secretCode ? 'error' : 'primary')
    });

    if (won) {
        embed.addFields({ name: '🏆 Result', value: `Congratulations! You guessed the code and won **$${REWARD}**!` });
    } else if (secretCode && !won) {
        const secretEmojis = secretCode.map(id => COLORS.find(c => c.id === id).emoji).join(' ');
        embed.addFields({ name: '💀 Game Over', value: `You ran out of tries. The secret code was: ${secretEmojis}` });
    }

    const rows = [];
    if (!secretCode) {
        const row1 = new ActionRowBuilder();
        const row2 = new ActionRowBuilder();
        
        for (let i = 0; i < 3; i++) {
            row1.addComponents(new ButtonBuilder().setCustomId(`mm_color_${COLORS[i].id}`).setEmoji(COLORS[i].emoji).setStyle(ButtonStyle.Secondary));
            row2.addComponents(new ButtonBuilder().setCustomId(`mm_color_${COLORS[i+3].id}`).setEmoji(COLORS[i+3].emoji).setStyle(ButtonStyle.Secondary));
        }
        rows.push(row1, row2);
    }

    return { embeds: [embed], components: rows };
}
