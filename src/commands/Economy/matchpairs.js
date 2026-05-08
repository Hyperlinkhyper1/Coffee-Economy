import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed, successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, addMoney, formatCurrency } from '../../utils/economy.js';
import { checkAndAnnounceAchievements } from '../../config/achievements.js';
import { logger } from '../../utils/logger.js';

const EMOJIS = ['🍎', '🍌', '🍇', '🍊', '🍓', '🍒', '🍍', '🥭', '🥝', '🍉'];
const GRID_ROWS = 4;
const GRID_COLS = 5;
const MAX_LIVES = 15;
const REWARD_AMOUNT = 250;

export default {
    data: new SlashCommandBuilder()
        .setName('matchpairs')
        .setDescription('Play a memory game to win money!'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const guildId = interaction.guildId;
        const userId = interaction.user.id;

        // Shuffle and create board
        const pairs = [...EMOJIS, ...EMOJIS];
        const board = pairs.sort(() => Math.random() - 0.5);
        
        let revealed = Array(20).fill(false);
        let matched = Array(20).fill(false);
        let lives = MAX_LIVES;
        let firstSelection = null;
        let processing = false;

        const getBoardButtons = (isDisabled = false) => {
            const rows = [];
            for (let i = 0; i < GRID_ROWS; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < GRID_COLS; j++) {
                    const index = i * GRID_COLS + j;
                    const isRevealed = revealed[index] || matched[index];
                    
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`match_cell_${index}`)
                            .setLabel(isRevealed ? board[index] : '?')
                            .setStyle(matched[index] ? ButtonStyle.Success : (revealed[index] ? ButtonStyle.Primary : ButtonStyle.Secondary))
                            .setDisabled(isDisabled || isRevealed)
                    );
                }
                rows.push(row);
            }
            return rows;
        };

        const createGameEmbed = () => {
            return createEmbed({
                title: "🧠 Memory Match",
                description: `Find all the matching pairs! Click the buttons to reveal the emojis.\n\n**Lives:** ${'❤️'.repeat(lives)} (${lives}/${MAX_LIVES})`,
                color: 'primary'
            });
        };

        const response = await interaction.reply({
            embeds: [createGameEmbed()],
            components: getBoardButtons(),
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 600000 // 10 minutes
        });

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                return i.reply({ content: "This is not your game!", ephemeral: true });
            }

            if (processing) {
                return i.reply({ content: "Please wait a moment...", ephemeral: true });
            }

            const index = parseInt(i.customId.replace('match_cell_', ''));
            
            if (firstSelection === null) {
                // First card revealed
                firstSelection = index;
                revealed[index] = true;
                await i.update({
                    embeds: [createGameEmbed()],
                    components: getBoardButtons()
                });
            } else {
                // Second card revealed
                const secondSelection = index;
                revealed[secondSelection] = true;
                
                if (board[firstSelection] === board[secondSelection]) {
                    // Match found
                    matched[firstSelection] = true;
                    matched[secondSelection] = true;
                    revealed[firstSelection] = false;
                    revealed[secondSelection] = false;
                    firstSelection = null;

                    const allMatched = matched.every(m => m === true);
                    if (allMatched) {
                        await addMoney(client, guildId, userId, REWARD_AMOUNT);
                        
                        // Stats and Achievements
                        try {
                            const userData = await getEconomyData(client, guildId, userId);
                            userData.stats.matchpairsWins = (userData.stats.matchpairsWins || 0) + 1;
                            await checkAndAnnounceAchievements(client, interaction.guild, interaction.member, userData);
                            await setEconomyData(client, guildId, userId, userData);
                        } catch (e) {
                            logger.error("Failed to update Match Pairs stats:", e);
                        }

                        await i.update({
                            embeds: [successEmbed(`🎉 **You won!** You found all the pairs and earned **${formatCurrency(REWARD_AMOUNT)}**!`)],
                            components: getBoardButtons(true)
                        });
                        collector.stop('win');
                    } else {
                        await i.update({
                            embeds: [createGameEmbed()],
                            components: getBoardButtons()
                        });
                    }
                } else {
                    // No match
                    lives--;
                    processing = true;

                    if (lives <= 0) {
                        await i.update({
                            embeds: [errorEmbed(`💀 **Game Over!** You ran out of lives. Better luck next time!`)],
                            components: getBoardButtons(true)
                        });
                        collector.stop('lose');
                    } else {
                        // Show both cards for a short time
                        await i.update({
                            embeds: [createGameEmbed()],
                            components: getBoardButtons(true) // Disable while showing
                        });

                        setTimeout(async () => {
                            try {
                                revealed[firstSelection] = false;
                                revealed[secondSelection] = false;
                                firstSelection = null;
                                processing = false;

                                await InteractionHelper.safeEditReply(interaction, {
                                    embeds: [createGameEmbed()],
                                    components: getBoardButtons()
                                });
                            } catch (err) {
                                logger.error("Failed to update memory game after mismatch delay:", err);
                            }
                        }, 2000);
                    }
                }
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({
                    content: "Game timed out.",
                    components: getBoardButtons(true)
                }).catch(() => {});
            }
        });
    }, { command: 'matchpairs' })
};
