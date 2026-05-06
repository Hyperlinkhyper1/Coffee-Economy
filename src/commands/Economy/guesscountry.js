import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed, infoEmbed, successEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData, addMoney, removeMoney } from '../../utils/economy.js';
import { checkAndAnnounceAchievements } from '../../config/achievements.js';

const COST = 100;
const REWARD = 500;
const COOLDOWN = 2 * 60 * 1000;

const COUNTRIES = [
    { name: 'France', emojis: '🗼🥐🍷', variants: ['Italy', 'Spain', 'Germany'] },
    { name: 'Japan', emojis: '🏯🍣🎎', variants: ['China', 'South Korea', 'Thailand'] },
    { name: 'USA', emojis: '🤠🍔🗽', variants: ['Canada', 'Australia', 'UK'] },
    { name: 'Italy', emojis: '🍕🍝🏟️', variants: ['France', 'Greece', 'Spain'] },
    { name: 'UK', emojis: '🎡☕💂', variants: ['Ireland', 'USA', 'Australia'] },
    { name: 'Australia', emojis: '🐨🦘🏖️', variants: ['New Zealand', 'South Africa', 'UK'] },
    { name: 'Spain', emojis: '🥘💃🐂', variants: ['Portugal', 'Mexico', 'Italy'] },
    { name: 'Germany', emojis: '🍺🥨🏰', variants: ['Austria', 'Poland', 'Belgium'] },
    { name: 'Canada', emojis: '🍁🏒❄️', variants: ['USA', 'Norway', 'Russia'] },
    { name: 'India', emojis: '🐘🕌🌶️', variants: ['Pakistan', 'Bangladesh', 'Sri Lanka'] },
    { name: 'China', emojis: '🐼🏮🐉', variants: ['Japan', 'Vietnam', 'Korea'] },
    { name: 'Brazil', emojis: '⚽🎭🦜', variants: ['Argentina', 'Colombia', 'Portugal'] },
    { name: 'Mexico', emojis: '🌮🌯🌵', variants: ['Spain', 'Colombia', 'Peru'] },
    { name: 'Egypt', emojis: '🐫🏺🏜️', variants: ['Morocco', 'Jordan', 'Greece'] },
    { name: 'Netherlands', emojis: '🌷🌬️🧀', variants: ['Denmark', 'Belgium', 'Sweden'] },
    { name: 'Switzerland', emojis: '🍫🏔️⌚', variants: ['Austria', 'Norway', 'Sweden'] },
    { name: 'Greece', emojis: '🏛️🥗🌊', variants: ['Italy', 'Turkey', 'Cyprus'] },
    { name: 'Norway', emojis: '🛶🏔️❄️', variants: ['Sweden', 'Finland', 'Iceland'] },
    { name: 'Russia', emojis: '🪆🏰🐻', variants: ['Ukraine', 'Belarus', 'Kazakhstan'] },
    { name: 'Turkey', emojis: '☕🥙🎈', variants: ['Greece', 'Iran', 'Egypt'] },
    { name: 'Thailand', emojis: '🐘🍜🥊', variants: ['Vietnam', 'Cambodia', 'Indonesia'] },
    { name: 'South Korea', emojis: '🍜🎤🏙️', variants: ['Japan', 'China', 'Taiwan'] },
    { name: 'Ireland', emojis: '🍀🍺🎻', variants: ['UK', 'Scotland', 'Wales'] },
    { name: 'Portugal', emojis: '🐟🍷🏰', variants: ['Spain', 'Brazil', 'Argentina'] },
    { name: 'Denmark', emojis: '🧜‍♀️🚲🧱', variants: ['Sweden', 'Norway', 'Netherlands'] },
    { name: 'New Zealand', emojis: '🥝🏔️🐑', variants: ['Australia', 'Fiji', 'Iceland'] },
    { name: 'South Africa', emojis: '🦁🇿🇦💎', variants: ['Kenya', 'Nigeria', 'Egypt'] },
    { name: 'Belgium', emojis: '🧇🍟🍫', variants: ['France', 'Netherlands', 'Germany'] },
    { name: 'Sweden', emojis: '🛋️🧆❄️', variants: ['Norway', 'Denmark', 'Finland'] },
    { name: 'Finland', emojis: '🧖‍♂️❄️🦌', variants: ['Sweden', 'Norway', 'Estonia'] }
];

export default {
    data: new SlashCommandBuilder()
        .setName('guesscountry')
        .setDescription('Guess the country from emojis to win money'),

    execute: withErrorHandling(async (interaction, config, client) => {
        const userId = interaction.user.id;
        const guildId = interaction.guildId;

        await InteractionHelper.safeDefer(interaction);

        const userData = await getEconomyData(client, guildId, userId);
        const lastPlay = userData.lastCountryGuess || 0;
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
            "Guess the country based on the emojis provided!\n\n" +
            `**Cost:** $${COST} | **Reward:** $${REWARD}\n` +
            "Click **Start** below to begin!",
            `🌍 Guess the Country - ${interaction.user.username}`
        );

        const startRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('gc_start').setLabel('Start Game').setStyle(ButtonStyle.Success)
        );

        const response = await InteractionHelper.safeEditReply(interaction, {
            embeds: [startEmbed],
            components: [startRow],
            fetchReply: true
        });

        if (!response) return;

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000 // 1 minute
        });

        collector.on('collect', async i => {
            if (i.customId === 'gc_start') {
                await removeMoney(client, guildId, userId, COST);
                const updatedData = await getEconomyData(client, guildId, userId);
                updatedData.lastCountryGuess = Date.now();
                await setEconomyData(client, guildId, userId, updatedData);

                const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
                const options = [country.name, ...country.variants].sort(() => Math.random() - 0.5);

                const gameEmbed = createEmbed({
                    title: `🌍 Guess the Country`,
                    description: `Which country is represented by these emojis?\n\n# ${country.emojis}`,
                    color: 'primary'
                });

                const rows = [];
                const row1 = new ActionRowBuilder();
                const row2 = new ActionRowBuilder();

                options.forEach((opt, index) => {
                    const btn = new ButtonBuilder()
                        .setCustomId(`gc_guess_${opt === country.name ? 'correct' : 'wrong'}_${opt}`)
                        .setLabel(opt)
                        .setStyle(ButtonStyle.Secondary);
                    
                    if (index < 2) row1.addComponents(btn);
                    else row2.addComponents(btn);
                });
                rows.push(row1, row2);

                await i.update({ embeds: [gameEmbed], components: rows });
            } 
            
            else if (i.customId.startsWith('gc_guess_')) {
                const isCorrect = i.customId.includes('_correct_');
                const selected = i.customId.split('_').pop();
                
                if (isCorrect) {
                    await addMoney(client, guildId, userId, REWARD);
                    const updatedData = await getEconomyData(client, guildId, userId);
                    updatedData.stats.countryWins = (updatedData.stats.countryWins || 0) + 1;
                    await checkAndAnnounceAchievements(client, interaction.guild, interaction.member, updatedData);
                    await setEconomyData(client, guildId, userId, updatedData);

                    const winEmbed = successEmbed(
                        `✅ Correct! It was **${selected}**.\nYou won **$${REWARD}**!`,
                        "🌍 Country Guessed!"
                    );
                    await i.update({ embeds: [winEmbed], components: [] });
                } else {
                    const loseEmbed = createEmbed({
                        title: "🌍 Wrong Guess!",
                        description: `❌ Incorrect. You guessed **${selected}**.\nBetter luck next time!`,
                        color: 'error'
                    });
                    await i.update({ embeds: [loseEmbed], components: [] });
                }
                collector.stop();
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && collected.size <= 1) {
                InteractionHelper.safeEditReply(interaction, { components: [] }).catch(() => {});
            }
        });

    }, { command: 'guesscountry' })
};
