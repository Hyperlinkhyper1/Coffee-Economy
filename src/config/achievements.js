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
    }
];

export function getAchievementStatus(userData) {
    const stats = userData.stats || {};
    
    return ACHIEVEMENTS.map(achievement => {
        const currentValue = stats[achievement.statKey] || 0;
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
