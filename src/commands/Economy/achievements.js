import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { createEmbed } from '../../utils/embeds.js';
import { getEconomyData } from '../../utils/economy.js';
import { getAchievementStatus } from '../../config/achievements.js';

export default {
    data: new SlashCommandBuilder()
        .setName('achievements')
        .setDescription('View your achievements or another user\'s achievements')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user you want to check achievements for')
                .setRequired(false)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;
        const guildId = interaction.guildId;

        await InteractionHelper.safeDefer(interaction);

        const userData = await getEconomyData(client, guildId, userId);
        const achievements = getAchievementStatus(userData);

        const embed = createEmbed({
            title: `🏆 ${targetUser.username}'s Achievements`,
            description: `Track your progress and unlock legendary ranks!\n\n`,
            color: 'economy'
        }).setThumbnail(targetUser.displayAvatarURL());

        achievements.forEach(achievement => {
            const level = achievement.currentLevel || 'None';
            const value = achievement.currentValue;
            
            let progressText = '';
            if (achievement.type === 'boolean') {
                progressText = value ? '✅ Completed' : '❌ Locked';
            } else {
                const next = achievement.nextThreshold;
                if (next) {
                    const progressBar = createProgressBar(value, next.value);
                    progressText = `${progressBar} (${value}/${next.value} to ${next.level})`;
                } else {
                    progressText = '⭐⭐⭐ **MAX LEVEL REACHED** ⭐⭐⭐';
                }
            }

            embed.addFields({
                name: `${achievement.name} - ${level}`,
                value: `${achievement.description}\n${progressText}`,
                inline: false
            });
        });

        await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });

    }, { command: 'achievements' })
};

function createProgressBar(current, max, size = 10) {
    const progress = Math.min(Math.max(0, current / max), 1);
    const filledCount = Math.round(size * progress);
    const emptyCount = size - filledCount;
    
    const filled = '▰'.repeat(filledCount);
    const empty = '▱'.repeat(emptyCount);
    
    return `\`${filled}${empty}\` ${Math.round(progress * 100)}%`;
}
