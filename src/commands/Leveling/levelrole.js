import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getLevelingConfig, saveLevelingConfig } from '../../services/leveling.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { successEmbed } from '../../utils/embeds.js';

export default {
    data: new SlashCommandBuilder()
        .setName('levelrole')
        .setDescription('Assign a role reward to a specific level')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('The level required to earn the role')
                .setRequired(true)
                .setMinValue(1)
        )
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('The role to give as a reward')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    execute: withErrorHandling(async (interaction, config, client) => {
        await InteractionHelper.safeDefer(interaction);
        
        const level = interaction.options.getInteger('level');
        const role = interaction.options.getRole('role');
        const guildId = interaction.guildId;

        const levelingConfig = await getLevelingConfig(client, guildId);
        
        if (!levelingConfig.roleRewards) {
            levelingConfig.roleRewards = {};
        }

        levelingConfig.roleRewards[level.toString()] = role.id;
        
        await saveLevelingConfig(client, guildId, levelingConfig);

        const embed = successEmbed(
            `Users will now receive the ${role} role when they reach level **${level}**.`,
            "Level Role Reward Set"
        );

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed]
        });
    }, { command: 'levelrole' })
};
