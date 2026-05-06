import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed, infoEmbed, successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, addMoney, removeMoney } from '../../utils/economy.js';
import { checkAndAnnounceAchievements } from '../../config/achievements.js';

const COST = 50;
const REWARD = 100;
const COOLDOWN = 1 * 60 * 1000;

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

        const equation = generateEquation();
        
        const startEmbed = infoEmbed(
            "Solve the math equation correctly to win the prize!\n\n" +
            `**Equation:** \`${equation.text}\`\n\n` +
            `**Cost:** $${COST} | **Reward:** $${REWARD}\n` +
            "Click **Answer** below to submit your result!",
            `🧮 Math Game - ${interaction.user.username}`
        );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('math_answer').setLabel('Answer').setStyle(ButtonStyle.Primary)
        );

        const response = await InteractionHelper.safeEditReply(interaction, {
            embeds: [startEmbed],
            components: [row],
            fetchReply: true
        });

        if (!response) return;

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 45000 // 45 seconds to answer
        });

        collector.on('collect', async i => {
            if (i.customId === 'math_answer') {
                const modal = new ModalBuilder()
                    .setCustomId('math_modal')
                    .setTitle('Solve the Equation');

                const answerInput = new TextInputBuilder()
                    .setCustomId('math_input')
                    .setLabel(`Solve: ${equation.text}`)
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

                    await removeMoney(client, guildId, userId, COST);
                    const updatedData = await getEconomyData(client, guildId, userId);
                    updatedData.lastMathGame = Date.now();
                    await setEconomyData(client, guildId, userId, updatedData);

                    if (userAnswer === equation.answer) {
                        await addMoney(client, guildId, userId, REWARD);
                        const finalData = await getEconomyData(client, guildId, userId);
                        finalData.stats.mathWins = (finalData.stats.mathWins || 0) + 1;
                        await checkAndAnnounceAchievements(client, interaction.guild, interaction.member, finalData);
                        await setEconomyData(client, guildId, userId, finalData);

                        const winEmbed = successEmbed(
                            `✅ Correct! **${equation.text} = ${equation.answer}**.\nYou won **$${REWARD}**!`,
                            "🧮 Math Master!"
                        );
                        await submission.reply({ embeds: [winEmbed] });
                    } else {
                        const loseEmbed = createEmbed({
                            title: "🧮 Wrong Answer!",
                            description: `❌ Incorrect. The correct answer was **${equation.answer}**.\nBetter luck next time!`,
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

function generateEquation() {
    const types = ['addition', 'subtraction', 'multiplication', 'mix'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let text = '';
    let answer = 0;

    switch (type) {
        case 'addition': {
            const a = Math.floor(Math.random() * 150) + 10;
            const b = Math.floor(Math.random() * 150) + 10;
            text = `${a} + ${b}`;
            answer = a + b;
            break;
        }
        case 'subtraction': {
            const a = Math.floor(Math.random() * 200) + 50;
            const b = Math.floor(Math.random() * a) + 10;
            text = `${a} - ${b}`;
            answer = a - b;
            break;
        }
        case 'multiplication': {
            const a = Math.floor(Math.random() * 15) + 3;
            const b = Math.floor(Math.random() * 15) + 3;
            text = `${a} × ${b}`;
            answer = a * b;
            break;
        }
        case 'mix': {
            const a = Math.floor(Math.random() * 12) + 2;
            const b = Math.floor(Math.random() * 12) + 2;
            const c = Math.floor(Math.random() * 50) + 10;
            text = `(${a} × ${b}) + ${c}`;
            answer = (a * b) + c;
            break;
        }
    }

    return { text, answer };
}
