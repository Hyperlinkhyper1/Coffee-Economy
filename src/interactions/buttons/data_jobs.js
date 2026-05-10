import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { withErrorHandling, createError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';
import { JOBS } from '../../utils/jobs.js'; // Import JOBS data

export default {
    name: 'data_jobs',
    async execute(interaction, client) {
        // Corrected call to safeDefer: pass an object { ephemeral: true }
        const deferred = await InteractionHelper.safeDefer(interaction, { ephemeral: true });
        if (!deferred) return;

        // More specific dev check (example - replace with actual dev IDs)
        const DEVELOPER_IDS = ['YOUR_DEV_ID_1', 'YOUR_DEV_ID_2']; // Replace with actual developer user IDs
        if (!DEVELOPER_IDS.includes(interaction.user.id) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            throw createError(
                "Insufficient permissions",
                ErrorTypes.VALIDATION,
                "This command is restricted to developers only."
            );
        }

        try {
            let jobsData = '=== All Job Data ===\n\n';

            if (JOBS.length === 0) {
                jobsData += 'No jobs found.\n';
            } else {
                JOBS.forEach(job => {
                    jobsData += `--- Job: ${job.name} (${job.id}) ---\n`;
                    jobsData += `  Emoji: ${job.emoji}\n`;
                    jobsData += `  Description: ${job.description}\n`;
                    jobsData += `  Pay Range: $${job.minPay.toLocaleString()}-$${job.maxPay.toLocaleString()}\n`;
                    if (job.shiftsRequired) {
                        jobsData += `  Shifts Required: ${job.shiftsRequired}\n`;
                    }
                    if (job.bankRequired) {
                        jobsData += `  Bank Required: $${job.bankRequired.toLocaleString()}\n`;
                    }
                    if (job.allowedUserId) {
                        jobsData += `  Allowed User ID: ${job.allowedUserId}\n`;
                    }
                    jobsData += '\n';
                });
            }

            const fileBuffer = Buffer.from(jobsData, 'utf-8');
            const attachment = new AttachmentBuilder(fileBuffer, { name: 'jobs_data.txt' });

            const embed = createEmbed({
                title: '💼 Jobs Data',
                description: 'Here is the data for all defined jobs.',
                color: '#00FF00' // Green for success
            });

            await InteractionHelper.safeEditReply(interaction, {
                embeds: [embed],
                files: [attachment],
                ephemeral: true
            });

        } catch (error) {
            logger.error('Error generating jobs data:', error);
            await InteractionHelper.safeEditReply(interaction, {
                embeds: [errorEmbed('Error', 'An error occurred while generating jobs data.')],
                ephemeral: true
            });
        }
    },
};