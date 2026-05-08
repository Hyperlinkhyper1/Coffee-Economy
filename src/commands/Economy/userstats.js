import { SlashCommandBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { getEconomyData, formatCurrency } from '../../utils/economy.js';
import { getJob } from '../../utils/jobs.js';
import { withErrorHandling } from '../../utils/errorHandler.js';

export default {
    data: new SlashCommandBuilder()
        .setName('userstats')
        .setDescription('View detailed statistics for a user')
        .addStringOption(option =>
            option.setName('user')
                .setDescription('The user to view stats for (type to search)')
                .setAutocomplete(true)
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        if (!interaction.guild) return interaction.respond([]);

        try {
            // Search members in the guild
            const members = await interaction.guild.members.fetch({ query: focusedValue, limit: 25 });
            
            await interaction.respond(
                members.map(member => ({
                    name: `${member.user.tag}${member.nickname ? ` (${member.nickname})` : ''}`,
                    value: member.id
                }))
            );
        } catch (error) {
            await interaction.respond([]).catch(() => {});
        }
    },

    execute: withErrorHandling(async (interaction, config, client) => {
        const userId = interaction.options.getString('user') || interaction.user.id;
        const guild = interaction.guild;
        
        // Try to fetch the member
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
            return interaction.reply({ content: "Could not find that user in this server.", ephemeral: true });
        }

        const user = member.user;
        const userData = await getEconomyData(client, guild.id, user.id);
        
        const joinDiscord = `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`;
        const joinServer = `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`;
        
        const messagesSent = userData.stats?.messages || 0;
        const roles = member.roles.cache
            .filter(role => role.name !== '@everyone')
            .sort((a, b) => b.position - a.position)
            .map(role => role.toString())
            .join(', ') || 'None';
            
        const wallet = userData.wallet || 0;
        const bank = userData.bank || 0;
        const totalMoney = wallet + bank;
        const networth = userData.stats?.totalGained || 0;

        const currentJob = getJob(userData.job || 'janitor');
        
        // Count medals
        const medals = {
            Bronze: 0,
            Silver: 0,
            Gold: 0,
            Platinum: 0,
            Diamond: 0,
            'Coffee Champion': 0
        };

        if (userData.announcedAchievements) {
            userData.announcedAchievements.forEach(achievementKey => {
                const [_, level] = achievementKey.split(':');
                if (medals.hasOwnProperty(level)) {
                    medals[level]++;
                }
            });
        }

        const medalString = Object.entries(medals)
            .filter(([_, count]) => count > 0)
            .map(([level, count]) => `**${level}:** ${count}`)
            .join(' | ') || 'None';

        const embed = createEmbed({
            title: `👤 User Statistics: ${user.username}`,
            thumbnail: user.displayAvatarURL({ dynamic: true })
        }).addFields(
            { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
            { name: '💼 Current Job', value: `${currentJob.emoji} **${currentJob.name}**`, inline: true },
            { name: '💬 Messages Sent', value: `**${messagesSent.toLocaleString()}**`, inline: true },
            { name: '💰 Current Total Money', value: `**${formatCurrency(totalMoney)}**`, inline: true },
            { name: '📈 Networth (Total Gained)', value: `**${formatCurrency(networth)}**`, inline: true },
            { name: '🏆 Medals', value: medalString, inline: false },
            { name: '📅 Joined Discord', value: joinDiscord, inline: false },
            { name: '📥 Joined Server', value: joinServer, inline: false },
            { name: '🎭 Roles', value: roles, inline: false }
        );

        await interaction.reply({ embeds: [embed] });
    }, { command: 'userstats' })
};
