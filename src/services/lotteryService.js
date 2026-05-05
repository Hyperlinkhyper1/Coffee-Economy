import { getEconomyData, addMoney, removeMoney } from '../utils/economy.js';
import { logger } from '../utils/logger.js';
import { successEmbed, infoEmbed } from '../utils/embeds.js';

const LOTTERY_KEY = (guildId) => `lottery:${guildId}`;
const LOTTERY_COST = 1000;
const MIN_PRIZE = 5000;
const MAX_PRIZE = 50000;
const DURATION = 60 * 60 * 1000; // 1 hour
const FILLERS = ['Filler 1', 'Filler 2', 'Filler 3', 'Filler 4', 'Filler 5'];

export class LotteryService {
    static async getLottery(client, guildId) {
        return await client.db.get(LOTTERY_KEY(guildId), null);
    }

    static async startLottery(client, guildId, firstUserId) {
        const endTime = Date.now() + DURATION;
        const lotteryData = {
            guildId,
            endTime,
            participants: [firstUserId],
            active: true
        };
        await client.db.set(LOTTERY_KEY(guildId), lotteryData);
        
        // Start the timer
        this.scheduleLotteryEnd(client, guildId, DURATION);
        return lotteryData;
    }

    static async joinLottery(client, guildId, userId) {
        const lottery = await this.getLottery(client, guildId);
        if (!lottery || !lottery.active) return { success: false, reason: 'No active lottery' };
        if (lottery.participants.includes(userId)) return { success: false, reason: 'Already joined' };

        lottery.participants.push(userId);
        await client.db.set(LOTTERY_KEY(guildId), lottery);
        return { success: true };
    }

    static scheduleLotteryEnd(client, guildId, delay) {
        setTimeout(async () => {
            await this.endLottery(client, guildId);
        }, delay);
    }

    static async endLottery(client, guildId) {
        const lottery = await this.getLottery(client, guildId);
        if (!lottery || !lottery.active) return;

        const participants = [...lottery.participants, ...FILLERS];
        const winnerIndex = Math.floor(Math.random() * participants.length);
        const winnerId = participants[winnerIndex];
        const prize = Math.floor(Math.random() * (MAX_PRIZE - MIN_PRIZE + 1)) + MIN_PRIZE;

        const guild = client.guilds.cache.get(guildId);
        const channelId = await this.getAnnounceChannel(client, guildId);
        const channel = guild?.channels.cache.get(channelId);

        let resultMessage = '';
        if (FILLERS.includes(winnerId)) {
            resultMessage = `The lottery has ended, but one of the fillers won! Better luck next time. No prize was awarded.`;
        } else {
            await addMoney(client, guildId, winnerId, prize);
            resultMessage = `🎊 **Lottery Winner!** 🎊\nCongratulations to <@${winnerId}> for winning the lottery and taking home **$${prize.toLocaleString()}**!`;
        }

        if (channel) {
            const embed = infoEmbed(resultMessage, "🎰 Lottery Results");
            await channel.send({ embeds: [embed] });
        }

        lottery.active = false;
        await client.db.set(LOTTERY_KEY(guildId), lottery);
    }

    static async getAnnounceChannel(client, guildId) {
        const config = await client.db.get(`guild:${guildId}:config`, {});
        return config.lotteryChannelId || config.logChannelId || null;
    }

    static async initialize(client) {
        for (const guild of client.guilds.cache.values()) {
            const lottery = await this.getLottery(client, guild.id);
            if (lottery && lottery.active) {
                const now = Date.now();
                if (now >= lottery.endTime) {
                    await this.endLottery(client, guild.id);
                } else {
                    this.scheduleLotteryEnd(client, guild.id, lottery.endTime - now);
                }
            }
        }
    }
}
