import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { getEconomyData, setEconomyData } from '../../utils/economy.js';
import { getJob } from '../../utils/jobs.js';
import { logger } from '../../utils/logger.js';

export default {
    name: 'job_select',
    async execute(interaction, client) {
        try {
            await interaction.deferUpdate();

            const userId = interaction.user.id;
            const guildId = interaction.guildId;
            const jobId = interaction.values[0];
            const job = getJob(jobId);

            const userData = await getEconomyData(client, guildId, userId);
            const shifts = userData.shifts || 0;

            if (shifts < job.shiftsRequired) {
                return await interaction.followUp({
                    embeds: [errorEmbed("🔒 Job Locked", `You need **${job.shiftsRequired}** total shifts to unlock the **${job.name}** job. You currently have **${shifts}** shifts.`)              ],
                    flags: [64]
                });
            }

            userData.job = job.id;
            await setEconomyData(client, guildId, userId, userData);

            const embed = successEmbed(
                "💼 Job Updated",
                `You are now working as a **${job.name}** ${job.emoji}!\n` +
                `└ Pay: $${job.minPay}-$${job.maxPay} per shift.`
            );

            await interaction.editReply({
                embeds: [embed],
                components: []
            });

            logger.info(`[ECONOMY] User ${userId} changed job to ${job.id}`, { userId, guildId, jobId: job.id });

        } catch (error) {
            logger.error('Error in job selection interaction:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred while selecting your job.', ephemeral: true });
            } else {
                await interaction.followUp({ content: 'An error occurred while selecting your job.', ephemeral: true });
            }
        }
    }
};
