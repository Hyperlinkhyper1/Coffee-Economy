import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed, infoEmbed, successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, addMoney, removeMoney, formatCurrency } from '../../utils/economy.js';
import { checkAndAnnounceAchievements } from '../../config/achievements.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('tictactoe')
        .setDescription('Play a game of Tic Tac Toe against another user for money')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('The user you want to challenge')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('bet')
                .setDescription('Amount of money to bet (optional)')
                .setRequired(false)
                .setMinValue(0)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const challenger = interaction.user;
        const opponent = interaction.options.getUser('opponent');
        const bet = interaction.options.getInteger('bet') || 0;
        const guildId = interaction.guildId;

        if (opponent.id === challenger.id) {
            throw createError("Invalid Opponent", ErrorTypes.VALIDATION, "You cannot challenge yourself to Tic Tac Toe!");
        }

        if (opponent.bot) {
            throw createError("Invalid Opponent", ErrorTypes.VALIDATION, "You cannot challenge a bot!");
        }

        await InteractionHelper.safeDefer(interaction);

        // Check challenger balance
        if (bet > 0) {
            const challengerData = await getEconomyData(client, guildId, challenger.id);
            if (challengerData.wallet < bet) {
                throw createError(
                    "Insufficient Funds",
                    ErrorTypes.VALIDATION,
                    `You don't have enough money in your wallet to bet **${formatCurrency(bet)}**.`
                );
            }
        }

        const challengeEmbed = infoEmbed(
            `**${challenger.username}** has challenged **${opponent.username}** to a game of Tic Tac Toe!\n` +
            (bet > 0 ? `**Bet:** ${formatCurrency(bet)}\n\n` : '\n') +
            `**${opponent.username}**, do you accept?`,
            "⚔️ Tic Tac Toe Challenge"
        );

        const challengeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ttt_accept').setLabel('Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('ttt_decline').setLabel('Decline').setStyle(ButtonStyle.Danger)
        );

        const response = await InteractionHelper.safeEditReply(interaction, {
            content: `<@${opponent.id}>`,
            embeds: [challengeEmbed],
            components: [challengeRow],
            fetchReply: true
        });

        if (!response) return;

        const collector = response.createMessageComponentCollector({
            filter: i => [challenger.id, opponent.id].includes(i.user.id),
            time: 60000,
            max: 1
        });

        collector.on('collect', async i => {
            if (i.user.id !== opponent.id) {
                if (i.customId === 'ttt_decline' && i.user.id === challenger.id) {
                    await i.update({
                        content: null,
                        embeds: [infoEmbed(`**${challenger.username}** cancelled the challenge.`, "⚔️ Challenge Cancelled")],
                        components: []
                    });
                    return;
                }
                return i.reply({ content: "Only the opponent can accept or decline this challenge!", ephemeral: true });
            }

            if (i.customId === 'ttt_decline') {
                await i.update({
                    content: null,
                    embeds: [infoEmbed(`**${opponent.username}** declined the challenge.`, "⚔️ Challenge Declined")],
                    components: []
                });
                return;
            }

            // Challenge accepted
            if (bet > 0) {
                const opponentData = await getEconomyData(client, guildId, opponent.id);
                if (opponentData.wallet < bet) {
                    await i.update({
                        content: null,
                        embeds: [errorEmbed(`**${opponent.username}** doesn't have enough money to accept this bet!`)],
                        components: []
                    });
                    return;
                }

                // Deduct bets
                await removeMoney(client, guildId, challenger.id, bet);
                await removeMoney(client, guildId, opponent.id, bet);
            }

            await startGame(i, challenger, opponent, bet, client, guildId);
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                InteractionHelper.safeEditReply(interaction, {
                    content: null,
                    embeds: [infoEmbed("The challenge expired because the opponent didn't respond in time.", "⏰ Challenge Expired")],
                    components: []
                }).catch(() => {});
            }
        });

    }, { command: 'tictactoe' })
};

async function startGame(interaction, challenger, opponent, bet, client, guildId) {
    let board = Array(9).fill(null);
    let currentPlayer = challenger;
    let gameState = 'playing'; // 'playing', 'won', 'draw'
    let winner = null;

    const getBoardButtons = (disabled = false) => {
        const rows = [];
        for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder();
            for (let j = 0; j < 3; j++) {
                const index = i * 3 + j;
                const value = board[index];
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`ttt_cell_${index}`)
                        .setLabel(value === 'X' ? 'X' : (value === 'O' ? 'O' : '\u200b'))
                        .setStyle(value === 'X' ? ButtonStyle.Danger : (value === 'O' ? ButtonStyle.Primary : ButtonStyle.Secondary))
                        .setDisabled(disabled || value !== null)
                );
            }
            rows.push(row);
        }
        return rows;
    };

    const checkWinner = () => {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Cols
            [0, 4, 8], [2, 4, 6]             // Diagonals
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return board[a];
            }
        }

        if (board.every(cell => cell !== null)) {
            return 'draw';
        }

        return null;
    };

    const updateMessage = async (i) => {
        let statusText = `**Current Turn:** <@${currentPlayer.id}> (${currentPlayer.id === challenger.id ? 'X' : 'O'})`;
        let color = 'primary';
        let title = "🎮 Tic Tac Toe";

        if (gameState === 'won') {
            statusText = `🎉 **${winner.username}** has won the game!`;
            if (bet > 0) statusText += `\nThey won **${formatCurrency(bet * 2)}**!`;
            color = 'success';
            title = "🏆 Game Over - Winner!";
        } else if (gameState === 'draw') {
            statusText = `🤝 It's a draw!`;
            if (bet > 0) statusText += `\nBoth players were refunded **${formatCurrency(bet)}**.`;
            color = 'warning';
            title = "🤝 Game Over - Draw";
        }

        const embed = createEmbed({
            title: title,
            description: statusText,
            color: color
        });

        if (bet > 0) {
            embed.addFields({ name: 'Pot', value: formatCurrency(bet * 2), inline: true });
        }

        const components = getBoardButtons(gameState !== 'playing');

        if (i.replied || i.deferred) {
            await i.editReply({ content: null, embeds: [embed], components: components });
        } else {
            await i.update({ content: null, embeds: [embed], components: components });
        }
    };

    const response = await interaction.update({
        content: null,
        embeds: [createEmbed({
            title: "🎮 Tic Tac Toe",
            description: `**Current Turn:** <@${currentPlayer.id}> (X)\n\nGame started!`,
            color: 'primary'
        })],
        components: getBoardButtons(),
        fetchReply: true
    });

    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000 // 5 minutes
    });

    collector.on('collect', async i => {
        if (i.user.id !== currentPlayer.id) {
            return i.reply({ content: "It's not your turn!", ephemeral: true });
        }

        const cellIndex = parseInt(i.customId.replace('ttt_cell_', ''));
        board[cellIndex] = currentPlayer.id === challenger.id ? 'X' : 'O';

        const result = checkWinner();
        if (result) {
            gameState = result === 'draw' ? 'draw' : 'won';
            winner = result === 'X' ? challenger : (result === 'O' ? opponent : null);
            
            if (gameState === 'won') {
                if (bet > 0) {
                    await addMoney(client, guildId, winner.id, bet * 2);
                }
                
                // Stats and Achievements
                try {
                    const winnerData = await getEconomyData(client, guildId, winner.id);
                    winnerData.stats.tttWins = (winnerData.stats.tttWins || 0) + 1;
                    await checkAndAnnounceAchievements(client, interaction.guild, winner.id === interaction.user.id ? interaction.member : await interaction.guild.members.fetch(winner.id), winnerData);
                    await setEconomyData(client, guildId, winner.id, winnerData);
                } catch (e) {
                    logger.error("Failed to update TTT stats:", e);
                }
            } else if (gameState === 'draw') {
                if (bet > 0) {
                    await addMoney(client, guildId, challenger.id, bet);
                    await addMoney(client, guildId, opponent.id, bet);
                }
            }
            
            await updateMessage(i);
            collector.stop('game_over');
        } else {
            currentPlayer = currentPlayer.id === challenger.id ? opponent : challenger;
            await updateMessage(i);
        }
    });

    collector.on('end', (collected, reason) => {
        if (reason === 'time' && gameState === 'playing') {
            // Handle timeout - maybe refund or award to the other player?
            // For now, just disable buttons
            const timeoutEmbed = errorEmbed(`The game ended because <@${currentPlayer.id}> took too long to move.`);
            if (bet > 0) {
                // Refund for now to be safe
                addMoney(client, guildId, challenger.id, bet);
                addMoney(client, guildId, opponent.id, bet);
                timeoutEmbed.addFields({ name: 'Refunded', value: `Both players have been refunded **${formatCurrency(bet)}**.` });
            }
            
            interaction.editReply({ embeds: [timeoutEmbed], components: getBoardButtons(true) }).catch(() => {});
        }
    });
}
