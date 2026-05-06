import { infoEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

export const ACHIEVEMENT_LEVELS = {
    BRONZE: 'Bronze',
    SILVER: 'Silver',
    GOLD: 'Gold',
    PLATINUM: 'Platinum',
    DIAMOND: 'Diamond',
    COFFEE_CHAMPION: 'Coffee Champion'
};

export const ACHIEVEMENTS = [
    {
        id: 'messages',
        name: 'Message Master',
        description: 'Send messages to climb the ranks.',
        type: 'stat',
        statKey: 'messages',
        thresholds: [
            { level: ACHIEVEMENT_LEVELS.BRONZE, value: 25 },
            { level: ACHIEVEMENT_LEVELS.SILVER, value: 100 },
            { level: ACHIEVEMENT_LEVELS.GOLD, value: 500 },
            { level: ACHIEVEMENT_LEVELS.PLATINUM, value: 1000 },
            { level: ACHIEVEMENT_LEVELS.DIAMOND, value: 2500 },
            { level: ACHIEVEMENT_LEVELS.COFFEE_CHAMPION, value: 5000 }
        ]
    },
    {
        id: 'reactions',
        name: 'Reaction Ruler',
        description: 'Add reactions to messages.',
        type: 'stat',
        statKey: 'reactions',
        thresholds: [
            { level: ACHIEVEMENT_LEVELS.BRONZE, value: 3 },
            { level: ACHIEVEMENT_LEVELS.SILVER, value: 10 },
            { level: ACHIEVEMENT_LEVELS.GOLD, value: 40 },
            { level: ACHIEVEMENT_LEVELS.PLATINUM, value: 100 },
            { level: ACHIEVEMENT_LEVELS.DIAMOND, value: 200 },
            { level: ACHIEVEMENT_LEVELS.COFFEE_CHAMPION, value: 500 }
        ]
    },
    {
        id: 'voice',
        name: 'Voice Veteran',
        description: 'Spend time in voice channels.',
        type: 'stat',
        statKey: 'voiceMinutes',
        thresholds: [
            { level: ACHIEVEMENT_LEVELS.BRONZE, value: 5 },
            { level: ACHIEVEMENT_LEVELS.SILVER, value: 15 },
            { level: ACHIEVEMENT_LEVELS.GOLD, value: 60 },
            { level: ACHIEVEMENT_LEVELS.PLATINUM, value: 120 },
            { level: ACHIEVEMENT_LEVELS.DIAMOND, value: 240 },
            { level: ACHIEVEMENT_LEVELS.COFFEE_CHAMPION, value: 540 }
        ]
    },
    {
        id: 'booster',
        name: 'Server Supporter',
        description: 'Boost the server to become a Coffee Champion.',
        type: 'boolean',
        statKey: 'isBoosting',
        thresholds: [
            { level: ACHIEVEMENT_LEVELS.COFFEE_CHAMPION, value: true }
        ]
    },
    {
        id: 'fights',
        name: 'Combatant',
        description: 'Win fights against other users.',
        type: 'stat',
        statKey: 'fightsWon',
        thresholds: [
            { level: ACHIEVEMENT_LEVELS.BRONZE, value: 3 },
            { level: ACHIEVEMENT_LEVELS.SILVER, value: 10 },
            { level: ACHIEVEMENT_LEVELS.GOLD, value: 25 },
            { level: ACHIEVEMENT_LEVELS.PLATINUM, value: 50 },
            { level: ACHIEVEMENT_LEVELS.DIAMOND, value: 75 },
            { level: ACHIEVEMENT_LEVELS.COFFEE_CHAMPION, value: 125 }
        ]
    },
    {
        id: 'shifts',
        name: 'Hard Worker',
        description: 'Work shifts to earn your keep.',
        type: 'stat',
        statKey: 'shifts',
        thresholds: [
            { level: ACHIEVEMENT_LEVELS.BRONZE, value: 10 },
            { level: ACHIEVEMENT_LEVELS.SILVER, value: 25 },
            { level: ACHIEVEMENT_LEVELS.GOLD, value: 50 },
            { level: ACHIEVEMENT_LEVELS.PLATINUM, value: 100 },
            { level: ACHIEVEMENT_LEVELS.DIAMOND, value: 150 },
            { level: ACHIEVEMENT_LEVELS.COFFEE_CHAMPION, value: 250 }
        ]
    },
    {
        id: 'mastermind',
        name: 'Mastermind Master',
        description: 'Win games of Mastermind.',
        type: 'stat',
        statKey: 'mastermindWins',
        thresholds: [
            { level: ACHIEVEMENT_LEVELS.BRONZE, value: 3 },
            { level: ACHIEVEMENT_LEVELS.SILVER, value: 8 },
            { level: ACHIEVEMENT_LEVELS.GOLD, value: 15 },
            { level: ACHIEVEMENT_LEVELS.PLATINUM, value: 25 },
            { level: ACHIEVEMENT_LEVELS.DIAMOND, value: 50 },
            { level: ACHIEVEMENT_LEVELS.COFFEE_CHAMPION, value: 100 }
        ]
    },
    {
        id: 'hangman',
        name: 'Hangman Hero',
        description: 'Win games of Hangman.',
        type: 'stat',
        statKey: 'hangmanWins',
        thresholds: [
            { level: ACHIEVEMENT_LEVELS.BRONZE, value: 3 },
            { level: ACHIEVEMENT_LEVELS.SILVER, value: 8 },
            { level: ACHIEVEMENT_LEVELS.GOLD, value: 15 },
            { level: ACHIEVEMENT_LEVELS.PLATINUM, value: 25 },
            { level: ACHIEVEMENT_LEVELS.DIAMOND, value: 50 },
            { level: ACHIEVEMENT_LEVELS.COFFEE_CHAMPION, value: 100 }
        ]
    },
    {
        id: 'countryWins',
        name: 'World Traveler',
        description: 'Correctly guess countries from emoji hints.',
        type: 'stat',
        statKey: 'countryWins',
        thresholds: [
            { level: ACHIEVEMENT_LEVELS.BRONZE, value: 3 },
            { level: ACHIEVEMENT_LEVELS.SILVER, value: 8 },
            { level: ACHIEVEMENT_LEVELS.GOLD, value: 15 },
            { level: ACHIEVEMENT_LEVELS.PLATINUM, value: 25 },
            { level: ACHIEVEMENT_LEVELS.DIAMOND, value: 50 },
            { level: ACHIEVEMENT_LEVELS.COFFEE_CHAMPION, value: 100 }
        ]
    },
    {
        id: 'guessNumberWins',
        name: 'Mind Reader',
        description: 'Correctly guess the secret number.',
        type: 'stat',
        statKey: 'guessNumberWins',
        thresholds: [
            { level: ACHIEVEMENT_LEVELS.BRONZE, value: 3 },
            { level: ACHIEVEMENT_LEVELS.SILVER, value: 8 },
            { level: ACHIEVEMENT_LEVELS.GOLD, value: 15 },
            { level: ACHIEVEMENT_LEVELS.PLATINUM, value: 25 },
            { level: ACHIEVEMENT_LEVELS.DIAMOND, value: 50 },
            { level: ACHIEVEMENT_LEVELS.COFFEE_CHAMPION, value: 100 }
        ]
    },
    {
        id: 'mathWins',
        name: 'Mathlete',
        description: 'Solve math equations correctly.',
        type: 'stat',
        statKey: 'mathWins',
        thresholds: [
            { level: ACHIEVEMENT_LEVELS.BRONZE, value: 5 },
            { level: ACHIEVEMENT_LEVELS.SILVER, value: 15 },
            { level: ACHIEVEMENT_LEVELS.GOLD, value: 40 },
            { level: ACHIEVEMENT_LEVELS.PLATINUM, value: 100 },
            { level: ACHIEVEMENT_LEVELS.DIAMOND, value: 200 },
            { level: ACHIEVEMENT_LEVELS.COFFEE_CHAMPION, value: 500 }
        ]
    }
];

export function getAchievementStatus(userData) {
    const stats = userData.stats || {};
    
    return ACHIEVEMENTS.map(achievement => {
        // Handle both nested stats and root level stats (like shifts)
        const currentValue = stats[achievement.statKey] !== undefined 
            ? stats[achievement.statKey] 
            : (userData[achievement.statKey] || 0);
            
        let currentLevel = null;
        let nextThreshold = null;

        for (const threshold of achievement.thresholds) {
            if (achievement.type === 'boolean') {
                if (currentValue === threshold.value) {
                    currentLevel = threshold.level;
                } else if (!currentLevel) {
                    nextThreshold = threshold;
                }
            } else {
                if (currentValue >= threshold.value) {
                    currentLevel = threshold.level;
                } else {
                    nextThreshold = threshold;
                    break;
                }
            }
        }

        return {
            ...achievement,
            currentValue,
            currentLevel,
            nextThreshold,
            progress: achievement.type === 'boolean' 
                ? (currentLevel ? 1 : 0) 
                : (nextThreshold ? currentValue / nextThreshold.value : 1)
        };
    });
}

export async function checkAndAnnounceAchievements(client, guild, member, userData) {
    try {
        const statuses = getAchievementStatus(userData);
        const newlyEarned = [];
        
        userData.announcedAchievements = userData.announcedAchievements || [];

        for (const status of statuses) {
            if (status.currentLevel) {
                const achievementKey = `${status.id}:${status.currentLevel}`;
                if (!userData.announcedAchievements.includes(achievementKey)) {
                    userData.announcedAchievements.push(achievementKey);
                    newlyEarned.push(status);
                }
            }
        }

        if (newlyEarned.length > 0) {
            // Get announcement channel (prioritize achievementChannel, then levelUpChannel, then system channel)
            const { getLevelingConfig } = await import('../services/leveling.js');
            const config = await getLevelingConfig(client, guild.id);
            const announceChannelId = config.achievementChannel || config.levelUpChannel || guild.systemChannelId;
            const channel = guild.channels.cache.get(announceChannelId);

            if (channel && channel.isTextBased()) {
                for (const achievement of newlyEarned) {
                    const embed = infoEmbed(
                        `Congratulations ${member}! You've earned the **${achievement.currentLevel}** rank in **${achievement.name}**!`,
                        "🏆 Achievement Unlocked!"
                    ).setThumbnail(member.user.displayAvatarURL());
                    
                    await channel.send({ embeds: [embed] }).catch(() => {});
                }
            }
            
            return true; // Data was modified
        }
    } catch (error) {
        logger.error('Error in checkAndAnnounceAchievements:', error);
    }
    return false;
}
