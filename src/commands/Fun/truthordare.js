import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { createEmbed, infoEmbed, errorEmbed } from '../../utils/embeds.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, '../../data/truthordare.json');

export default {
    data: new SlashCommandBuilder()
        .setName('truthordare')
        .setDescription('Play a game of Truth or Dare!')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user who has to answer/do the dare')
                .setRequired(false)
        ),
    category: 'Fun',

    execute: withErrorHandling(async (interaction, config, client) => {
        const target = interaction.options.getUser('target') || interaction.user;
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('tod_truth')
                    .setLabel('Truth')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🤔'),
                new ButtonBuilder()
                    .setCustomId('tod_dare')
                    .setLabel('Dare')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔥')
            );

        const embed = infoEmbed(
            `**${target.username}**, pick your poison! Truth or Dare?`,
            "🎲 Truth or Dare"
        );

        const response = await interaction.reply({
            content: `<@${target.id}>`,
            embeds: [embed],
            components: [row]
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000 // 1 minute timeout
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== target.id) {
                return i.reply({ content: `Only ${target.username} can choose!`, flags: 64 });
            }

            try {
                const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
                const type = i.customId === 'tod_truth' ? 'truth' : 'dare';
                const questions = data[type];
                const randomQuestion = questions[Math.floor(Math.random() * questions.length)];

                const resultEmbed = createEmbed({
                    title: type === 'truth' ? '🤔 Truth' : '🔥 Dare',
                    description: `**${target.username}**, your ${type} is:\n\n${randomQuestion}`,
                    color: type === 'truth' ? '#3498db' : '#e74c3c'
                }).setThumbnail(target.displayAvatarURL());

                await i.update({
                    content: `<@${target.id}>`,
                    embeds: [resultEmbed],
                    components: []
                });
                
                collector.stop('chosen');
            } catch (err) {
                logger.error('Error in Truth or Dare command:', err);
                await i.update({
                    embeds: [errorEmbed('An error occurred while fetching the question.', '❌ Error')],
                    components: []
                });
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({
                    content: "Game timed out! Nobody chose anything.",
                    components: []
                }).catch(() => {});
            }
        });
    }, { command: 'truthordare' })
};
