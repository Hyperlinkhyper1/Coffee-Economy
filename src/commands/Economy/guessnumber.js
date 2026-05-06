import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed, infoEmbed, successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, addMoney, removeMoney } from '../../utils/economy.js';
import { checkAndAnnounceAchievements } from '../../config/achievements.js';

const COST = 50;
const COOLDOWN = 2 * 60 * 1000;

const RANGES = {
    '10': { max: 10, reward: 200 },
    '25': { max: 25, reward: 1000 },
    '100': { max: 100, reward: 5000 }
};

export default {
    data: new SlashCommandBuilder()
        .setName('guessnumber')
        .setDescription('Guess a secret number within a range to win money'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        await InteractionHelper.safeDefer(interaction);

        const userData = await getEconomyData(client, guildId, userId);
        const lastPlay = userData.lastGuessNumber || 0;
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
            "Choose a range for the secret number. Higher ranges give bigger rewards!\n\n" +
            "• **1 - 10**: $200 Reward\n" +
            "• **1 - 25**: $1000 Reward\n" +
            "• **1 - 100**: $5000 Reward\n\n" +
            `**Cost:** $${COST}\n` +
            "Select your range below to start!",
            `🔢 Guess the Number - ${interaction.user.username}`
        );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('gn_range_10').setLabel('1 - 10').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('gn_range_25').setLabel('1 - 25').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('gn_range_100').setLabel('1 - 100').setStyle(ButtonStyle.Danger)
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

        collector.on('collect', async i => {
            const rangeKey = i.customId.replace('gn_range_', '');
            const range = RANGES[rangeKey];

            if (!range) return;

            // Use Modal for the guess
            const modal = new ModalBuilder()
                .setCustomId(`gn_modal_${rangeKey}`)
                .setTitle(`Guess the Number (1 - ${rangeKey})`);

            const guessInput = new TextInputBuilder()
                .setCustomId('gn_input')
                .setLabel(`Your guess (1 to ${rangeKey})`)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter your number...')
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(3);

            modal.addComponents(new ActionRowBuilder().addComponents(guessInput));

            await i.showModal(modal);

            // Wait for modal submission
            try {
                const submission = await i.awaitModalSubmit({
                    filter: sm => sm.customId === `gn_modal_${rangeKey}` && sm.user.id === interaction.user.id,
                    time: 30000
                });

                const guess = parseInt(submission.fields.getTextInputValue('gn_input'));

                if (isNaN(guess) || guess < 1 || guess > range.max) {
                    await submission.reply({ content: `❌ Invalid guess! Please enter a number between 1 and ${range.max}.`, ephemeral: true });
                    return;
                }

                await removeMoney(client, guildId, userId, COST);
                const updatedData = await getEconomyData(client, guildId, userId);
                updatedData.lastGuessNumber = Date.now();
                await setEconomyData(client, guildId, userId, updatedData);

                const secretNumber = Math.floor(Math.random() * range.max) + 1;

                if (guess === secretNumber) {
                    await addMoney(client, guildId, userId, range.reward);
                    const finalData = await getEconomyData(client, guildId, userId);
                    finalData.stats.guessNumberWins = (finalData.stats.guessNumberWins || 0) + 1;
                    await checkAndAnnounceAchievements(client, interaction.guild, interaction.member, finalData);
                    await setEconomyData(client, guildId, userId, finalData);

                    const winEmbed = successEmbed(
                        `🎉 **JACKPOT!** The secret number was indeed **${secretNumber}**!\nYou won **$${range.reward.toLocaleString()}**!`,
                        "🔢 Number Guessed!"
                    );
                    await submission.reply({ embeds: [winEmbed] });
                } else {
                    const loseEmbed = createEmbed({
                        title: "🔢 Wrong Guess!",
                        description: `❌ Incorrect. Your guess: **${guess}** | Secret Number: **${secretNumber}**.\nBetter luck next time!`,
                        color: 'error'
                    });
                    await submission.reply({ embeds: [loseEmbed] });
                }

                // Cleanup original message
                await InteractionHelper.safeEditReply(interaction, { components: [] });
                collector.stop();

            } catch (err) {
                // Modal timed out or other error
            }
        });

    }, { command: 'guessnumber' })
};
