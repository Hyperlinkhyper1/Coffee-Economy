import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed, infoEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, addMoney, removeMoney } from '../../utils/economy.js';
import { checkAndAnnounceAchievements } from '../../config/achievements.js';

const COST = 100;
const REWARD = 500;
const COOLDOWN = 2 * 60 * 1000;
const LIVES = 10;

const WORDS = [
    'COFFEE', 'ECONOMY', 'DISCORD', 'PROGRAMMING', 'DEVELOPER', 'HANGMAN', 'ROBOT', 'COMPUTER', 'INTERNET',
    'GAMING', 'VICTORY', 'CHALLENGE', 'CRYPTO', 'BITCOIN', 'ETHIOPIA', 'BRAZIL', 'ROASTING', 'BARISTA',
    'ESPRESSO', 'CAPPUCCINO', 'LATTE', 'MOCHA', 'CAFFEINE', 'MORNING', 'KITCHEN', 'FRIENDS', 'COMMUNITY',
    'SERVER', 'CHANNEL', 'MESSAGE', 'REACTION', 'COMMAND', 'UTILITY', 'DATABASE', 'SYSTEM', 'NETWORK',
    'AERODYNAMICS', 'BACKPACK', 'CALENDAR', 'DANGEROUS', 'EFFICIENT', 'FACEBOOK', 'GENERATION', 'HAPPINESS',
    'IMMEDIATELY', 'JOURNALIST', 'KNOWLEDGE', 'LANDSCAPE', 'MANAGEMENT', 'NOTEBOOK', 'OBSERVATION', 'PASSWORD',
    'QUESTION', 'REASONABLE', 'SATELLITE', 'TELEVISION', 'UNDERGROUND', 'VEGETABLE', 'WONDERFUL', 'YESTERDAY',
    'ZEALOUS', 'ACADEMY', 'BALANCE', 'CAPACITY', 'DECADE', 'ELEMENT', 'FACTORY', 'GARDEN', 'HABITAT', 'IDENTITY',
    'JACKET', 'KETTLE', 'LABORATORY', 'MACHINE', 'NATURE', 'OBJECT', 'PACKAGE', 'QUALITY', 'RABBIT', 'SAFETY',
    'TABLET', 'UMBRELLA', 'VACUUM', 'WALLET', 'XYLOPHONE', 'YACHT', 'ZODIAC'
];

export default {
    data: new SlashCommandBuilder()
        .setName('hangman')
        .setDescription('Play a game of Hangman for a chance to win money'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        await InteractionHelper.safeDefer(interaction);

        const userData = await getEconomyData(client, guildId, userId);
        const lastPlay = userData.lastHangman || 0;
        const now = Date.now();

        if (now < lastPlay + COOLDOWN) {
            const remaining = lastPlay + COOLDOWN - now;
            throw createError(
                "Cooldown Active",
                ErrorTypes.RATE_LIMIT,
                `You need to wait **${Math.floor(remaining / 1000)}s** before playing Hangman again.`
            );
        }

        if (userData.wallet < COST) {
            throw createError(
                "Insufficient Funds",
                ErrorTypes.VALIDATION,
                `You need **$${COST}** to play Hangman.`
            );
        }

        const startEmbed = infoEmbed(
            "The goal of Hangman is to guess the secret word before the man is fully hung.\n\n" +
            "**How to play:**\n" +
            "• Select letters using the buttons.\n" +
            "• Each wrong guess removes 1 life.\n" +
            "• You have 10 lives.\n\n" +
            `**Cost:** $${COST} | **Reward:** $${REWARD}\n` +
            "Click **Start** below to begin!",
            `🎮 Hangman - ${interaction.user.username}`
        );

        const startRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hm_start').setLabel('Start Game').setStyle(ButtonStyle.Success)
        );

        const response = await InteractionHelper.safeEditReply(interaction, {
            embeds: [startEmbed],
            components: [startRow],
            fetchReply: true
        });

        if (!response) return;

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 600000
        });

        let gameState = 'lobby';
        let word = '';
        let guessedLetters = new Set();
        let wrongGuesses = 0;
        let currentPage = 0; // 0 for A-M, 1 for N-Z

        collector.on('collect', async i => {
            if (i.customId === 'hm_start' && gameState === 'lobby') {
                await removeMoney(client, guildId, userId, COST);
                const updatedData = await getEconomyData(client, guildId, userId);
                updatedData.lastHangman = Date.now();
                await setEconomyData(client, guildId, userId, updatedData);

                gameState = 'playing';
                word = WORDS[Math.floor(Math.random() * WORDS.length)].toUpperCase();
                
                await i.update(updateGameDisplay(interaction, word, guessedLetters, wrongGuesses, currentPage));
            } 
            
            else if (i.customId.startsWith('hm_letter_') && gameState === 'playing') {
                const letter = i.customId.replace('hm_letter_', '');
                guessedLetters.add(letter);

                if (!word.includes(letter)) {
                    wrongGuesses++;
                }

                const isWon = word.split('').every(l => guessedLetters.has(l));
                if (isWon) {
                    gameState = 'won';
                } else if (wrongGuesses >= LIVES) {
                    gameState = 'lost';
                }

                if (gameState === 'won') {
                    await addMoney(client, guildId, userId, REWARD);
                    const updatedData = await getEconomyData(client, guildId, userId);
                    updatedData.stats.hangmanWins = (updatedData.stats.hangmanWins || 0) + 1;
                    await checkAndAnnounceAchievements(client, interaction.guild, interaction.member, updatedData);
                    await setEconomyData(client, guildId, userId, updatedData);
                    
                    await i.update(updateGameDisplay(interaction, word, guessedLetters, wrongGuesses, currentPage, true));
                    collector.stop('game_over');
                } else if (gameState === 'lost') {
                    await i.update(updateGameDisplay(interaction, word, guessedLetters, wrongGuesses, currentPage, false));
                    collector.stop('game_over');
                } else {
                    await i.update(updateGameDisplay(interaction, word, guessedLetters, wrongGuesses, currentPage));
                }
            }

            else if (i.customId === 'hm_page_toggle' && gameState === 'playing') {
                currentPage = currentPage === 0 ? 1 : 0;
                await i.update(updateGameDisplay(interaction, word, guessedLetters, wrongGuesses, currentPage));
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason !== 'game_over') {
                InteractionHelper.safeEditReply(interaction, { components: [] }).catch(() => {});
            }
        });

    }, { command: 'hangman' })
};

function getHangmanVisual(wrongGuesses) {
    const stages = [
        "```\n\n\n\n\n\n\n__________```",
        "```\n|\n|\n|\n|\n|\n|__________```",
        "```\n|‾‾‾‾‾‾|\n|\n|\n|\n|\n|\n|__________```",
        "```\n|‾‾‾‾‾‾|\n|       🎩\n|\n|\n|\n|\n|__________```",
        "```\n|‾‾‾‾‾‾|\n|       🎩\n|      😟\n|\n|\n|\n|__________```",
        "```\n|‾‾‾‾‾‾|\n|       🎩\n|      😟\n|      👕\n|\n|\n|__________```",
        "```\n|‾‾‾‾‾‾|\n|       🎩\n|      😟\n|     💪👕\n|\n|\n|__________```",
        "```\n|‾‾‾‾‾‾|\n|       🎩\n|      😟\n|     💪👕💪\n|\n|\n|__________```",
        "```\n|‾‾‾‾‾‾|\n|       🎩\n|      😟\n|     💪👕💪\n|      👖\n|\n|__________```",
        "```\n|‾‾‾‾‾‾|\n|       🎩\n|      😟\n|     💪👕💪\n|      👖\n|     👞\n|__________```",
        "```\n|‾‾‾‾‾‾|\n|       🎩\n|      😟\n|     💪👕💪\n|      👖\n|     👞👞\n|__________```"
    ];
    return stages[Math.min(wrongGuesses, LIVES)];
}

function updateGameDisplay(interaction, word, guessedLetters, wrongGuesses, currentPage, finished = null) {
    const displayWord = word.split('').map(l => guessedLetters.has(l) ? l : '_').join(' ');
    const visual = getHangmanVisual(wrongGuesses);
    
    let description = `${visual}\n\n**Word:** \`${displayWord}\`\n**Lives:** ${LIVES - wrongGuesses}\n`;
    
    const embed = createEmbed({
        title: `🎮 Hangman - ${interaction.user.username}`,
        description: description,
        color: finished === true ? 'success' : (finished === false ? 'error' : 'primary')
    });

    if (finished === true) {
        embed.addFields({ name: '🏆 Result', value: `Congratulations! You guessed the word and won **$${REWARD}**!` });
    } else if (finished === false) {
        embed.addFields({ name: '💀 Game Over', value: `You ran out of lives. The word was: **${word}**` });
    }

    const rows = [];
    if (finished === null) {
        const letters = currentPage === 0 ? "ABCDEFGHIJKLM".split('') : "NOPQRSTUVWXYZ".split('');
        
        for (let i = 0; i < letters.length; i += 5) {
            const row = new ActionRowBuilder();
            const chunk = letters.slice(i, i + 5);
            chunk.forEach(l => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`hm_letter_${l}`)
                        .setLabel(l)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(guessedLetters.has(l))
                );
            });
            rows.push(row);
        }

        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('hm_page_toggle')
                .setLabel(currentPage === 0 ? 'Next Page (N-Z)' : 'Prev Page (A-M)')
                .setStyle(ButtonStyle.Primary)
        );
        rows.push(controlRow);
    }

    return { embeds: [embed], components: rows };
}
