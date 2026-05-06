import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed, infoEmbed, successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, addMoney, removeMoney } from '../../utils/economy.js';
import { checkAndAnnounceAchievements } from '../../config/achievements.js';

const COST = 50;
const COOLDOWN = 1 * 60 * 1000;

const DIFFICULTIES = {
    easy: { label: 'Easy', reward: 100 },
    medium: { label: 'Medium', reward: 250 },
    hard: { label: 'Hard', reward: 500 }
};

export default {
    data: new SlashCommandBuilder()
        .setName('mathgame')
        .setDescription('Solve a math equation to win money'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        await InteractionHelper.safeDefer(interaction);

        const userData = await getEconomyData(client, guildId, userId);
        const lastPlay = userData.lastMathGame || 0;
        const now = Date.now();

        if (now < lastPlay + COOLDOWN) {
            const remaining = lastPlay + COOLDOWN - now;
            throw createError(
                "Cooldown Active",
                ErrorTypes.RATE_LIMIT,
                `You need to wait **${Math.floor(remaining / 1000)}s** before playing again.`
            );
        }

        if (userData.wallet < COST) {
            throw createError(
                "Insufficient Funds",
                ErrorTypes.VALIDATION,
                `You need **$${COST}** to play.`
            );
        }

        const startEmbed = infoEmbed(
            "Choose your difficulty level! Harder equations give bigger rewards.\n\n" +
            "🟢 **Easy**: $100 Reward\n" +
            "🔵 **Medium**: $250 Reward\n" +
            "🔴 **Hard**: $500 Reward\n\n" +
            `**Cost:** $${COST}\n` +
            "Select a difficulty below to begin!",
            `🧮 Math Game - ${interaction.user.username}`
        );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('math_diff_easy').setLabel('Easy').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('math_diff_medium').setLabel('Medium').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('math_diff_hard').setLabel('Hard').setStyle(ButtonStyle.Danger)
        );

        const response = await InteractionHelper.safeEditReply(interaction, {
            embeds: [startEmbed],
            components: [row],
            fetchReply: true
        });

        if (!response) return;

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        });

        let currentDifficulty = null;
        let currentEquation = null;

        collector.on('collect', async i => {
            if (i.customId.startsWith('math_diff_')) {
                currentDifficulty = i.customId.replace('math_diff_', '');
                const diffConfig = DIFFICULTIES[currentDifficulty];
                currentEquation = generateEquation(currentDifficulty);

                const gameEmbed = createEmbed({
                    title: `🧮 Math Game (${diffConfig.label})`,
                    description: `Solve the following equation:\n\n# ${currentEquation.text}\n\n` +
                                 `**Reward:** $${diffConfig.reward}\n` +
                                 "Click **Answer** below to submit your result!",
                    color: currentDifficulty === 'easy' ? 'success' : (currentDifficulty === 'hard' ? 'error' : 'primary')
                });

                const answerRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('math_answer_submit').setLabel('Answer').setStyle(ButtonStyle.Primary)
                );

                await i.update({ embeds: [gameEmbed], components: [answerRow] });
            }

            else if (i.customId === 'math_answer_submit') {
                const modal = new ModalBuilder()
                    .setCustomId('math_modal')
                    .setTitle('Solve the Equation');

                const answerInput = new TextInputBuilder()
                    .setCustomId('math_input')
                    .setLabel(`Solve: ${currentEquation.text}`)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Enter the answer...')
                    .setRequired(true)
                    .setMinLength(1)
                    .setMaxLength(10);

                modal.addComponents(new ActionRowBuilder().addComponents(answerInput));

                await i.showModal(modal);

                try {
                    const submission = await i.awaitModalSubmit({
                        filter: sm => sm.customId === 'math_modal' && sm.user.id === interaction.user.id,
                        time: 30000
                    });

                    const userAnswer = parseInt(submission.fields.getTextInputValue('math_input'));
                    const diffConfig = DIFFICULTIES[currentDifficulty];

                    await removeMoney(client, guildId, userId, COST);
                    const updatedData = await getEconomyData(client, guildId, userId);
                    updatedData.lastMathGame = Date.now();
                    await setEconomyData(client, guildId, userId, updatedData);

                    if (userAnswer === currentEquation.answer) {
                        await addMoney(client, guildId, userId, diffConfig.reward);
                        const finalData = await getEconomyData(client, guildId, userId);
                        finalData.stats.mathWins = (finalData.stats.mathWins || 0) + 1;
                        await checkAndAnnounceAchievements(client, interaction.guild, interaction.member, finalData);
                        await setEconomyData(client, guildId, userId, finalData);

                        const winEmbed = successEmbed(
                            `✅ Correct! **${currentEquation.text} = ${currentEquation.answer}**.\nYou won **$${diffConfig.reward}**!`,
                            "🧮 Math Master!"
                        );
                        await submission.reply({ embeds: [winEmbed] });
                    } else {
                        const loseEmbed = createEmbed({
                            title: "🧮 Wrong Answer!",
                            description: `❌ Incorrect. The correct answer was **${currentEquation.answer}**.\nBetter luck next time!`,
                            color: 'error'
                        });
                        await submission.reply({ embeds: [loseEmbed] });
                    }

                    await InteractionHelper.safeEditReply(interaction, { components: [] });
                    collector.stop();

                } catch (err) {
                    // Modal timeout
                }
            }
        });

    }, { command: 'mathgame' })
};

function generateEquation(difficulty) {
    let text = '';
    let answer = 0;

    if (difficulty === 'easy') {
        const types = ['addition', 'subtraction', 'multiplication'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        switch (type) {
            case 'addition': {
                const a = Math.floor(Math.random() * 50) + 1;
                const b = Math.floor(Math.random() * 50) + 1;
                text = `${a} + ${b}`;
                answer = a + b;
                break;
            }
            case 'subtraction': {
                const a = Math.floor(Math.random() * 50) + 20;
                const b = Math.floor(Math.random() * a) + 1;
                text = `${a} - ${b}`;
                answer = a - b;
                break;
            }
            case 'multiplication': {
                const a = Math.floor(Math.random() * 10) + 2;
                const b = Math.floor(Math.random() * 10) + 2;
                text = `${a} × ${b}`;
                answer = a * b;
                break;
            }
        }
    } else if (difficulty === 'medium') {
        const types = ['multiplication', 'mix', 'division'];
        const type = types[Math.floor(Math.random() * types.length)];

        switch (type) {
            case 'multiplication': {
                const a = Math.floor(Math.random() * 20) + 10;
                const b = Math.floor(Math.random() * 15) + 5;
                text = `${a} × ${b}`;
                answer = a * b;
                break;
            }
            case 'mix': {
                const a = Math.floor(Math.random() * 10) + 2;
                const b = Math.floor(Math.random() * 10) + 2;
                const c = Math.floor(Math.random() * 50) + 10;
                text = `(${a} × ${b}) + ${c}`;
                answer = (a * b) + c;
                break;
            }
            case 'division': {
                const b = Math.floor(Math.random() * 12) + 2;
                answer = Math.floor(Math.random() * 12) + 2;
                const a = b * answer;
                text = `${a} ÷ ${b}`;
                break;
            }
        }
    } else { // Hard
        const a = Math.floor(Math.random() * 40) + 10;
        const b = Math.floor(Math.random() * 30) + 10;
        const c = Math.floor(Math.random() * 100) + 50;
        const type = Math.random() > 0.5 ? 'hard_mix' : 'triple';

        if (type === 'hard_mix') {
            text = `(${a} × ${b}) - ${c}`;
            answer = (a * b) - c;
        } else {
            const d = Math.floor(Math.random() * 50) + 10;
            text = `${a} + ${b} + ${c} - ${d}`;
            answer = a + b + c - d;
        }
    }

    return { text, answer };
}
