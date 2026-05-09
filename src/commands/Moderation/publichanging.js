import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { createEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { ModerationService } from '../../services/moderationService.js';

export default {
    data: new SlashCommandBuilder()
        .setName("publichanging")
        .setDescription("Publicly hangs (kicks) a user after a 15-second countdown")
        .addUserOption(option =>
            option.setName('target')
                .setDescription('The user to hang')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        const target = interaction.options.getUser('target');
        const targetMember = interaction.options.getMember('target');

        if (!targetMember) {
            return await InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('User not found in this server.')],
                flags: MessageFlags.Ephemeral,
            });
        }

        try {
            const botCheck = ModerationService.validateBotHierarchy(interaction.client, targetMember, 'hang');
            if (!botCheck.valid) {
                return await InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed(botCheck.error)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            const modCheck = ModerationService.validateHierarchy(interaction.member, targetMember, 'hang');
            if (!modCheck.valid) {
                return await InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed(modCheck.error)],
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (!targetMember.kickable) {
                return await InteractionHelper.safeReply(interaction, {
                    embeds: [errorEmbed('I do not have permission to kick this member.')],
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (error) {
            logger.error('Validation error for publichanging:', error);
            return await InteractionHelper.safeReply(interaction, {
                embeds: [errorEmbed('An error occurred while validating the command.', error)],
                flags: MessageFlags.Ephemeral,
            });
        }

        let seconds = 15;
        
        await InteractionHelper.safeReply(interaction, {
            content: `public hanging in ${seconds} seconds: ${target}`,
        });

        const countdownInterval = setInterval(async () => {
            seconds--;
            if (seconds > 0) {
                await InteractionHelper.safeEditReply(interaction, {
                    content: `public hanging in ${seconds} seconds: ${target}`,
                });
            } else {
                clearInterval(countdownInterval);
                
                try {
                    await ModerationService.kickUser({
                        guild: interaction.guild,
                        member: targetMember,
                        moderator: interaction.member,
                        reason: 'Public Hanging'
                    });

                    await InteractionHelper.safeEditReply(interaction, {
                        content: `public hanging in 0 seconds: ${target}\nUser ${target.tag} has been publicly hung.`,
                    });
                } catch (error) {
                    logger.error('Error kicking user in publichanging:', error);
                    await InteractionHelper.safeEditReply(interaction, {
                        content: `Failed to hang ${target.tag}: ${error.message}`,
                    });
                }
            }
        }, 1000);
    },
};
