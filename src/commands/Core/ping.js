import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import os from 'os';
import fs from 'fs';
import path from 'path';

function getSystemResources() {
    // CPU Usage
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
        for (let type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const cpuUsage = 100 - ~~(100 * idle / total);

    // RAM Usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramUsage = Math.round((usedMem / totalMem) * 100);

    // Disk Space (Windows - using system drive)
    let diskInfo = { used: 'N/A', available: 'N/A' };
    try {
        // Get the system drive (usually C:)
        const systemDrive = process.env.SystemDrive || 'C:';
        const drivePath = systemDrive + '\\';

        // Use fs.statSync to get basic info, but for Windows disk space
        // we'll provide a note that it's not easily accessible via Node.js
        diskInfo = {
            used: 'Use Task Manager',
            available: 'Use File Explorer'
        };
    } catch (error) {
        diskInfo = { used: 'N/A', available: 'N/A' };
    }

    return {
        cpu: cpuUsage,
        ram: {
            used: Math.round(usedMem / 1024 / 1024 / 1024 * 100) / 100, // GB
            total: Math.round(totalMem / 1024 / 1024 / 1024 * 100) / 100, // GB
            percentage: ramUsage
        },
        disk: diskInfo
    };
}

export default {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Checks the bot's latency and API speed"),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) {
            logger.warn(`Ping interaction defer failed`, {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'ping'
            });
            return;
        }

        try {
            await InteractionHelper.safeEditReply(interaction, {
                content: "Pinging...",
            });

            const latency = Date.now() - interaction.createdTimestamp;
            const apiLatency = Math.round(interaction.client.ws.ping);

            const { cpu, ram, disk } = getSystemResources();

            const embed = createEmbed({ title: "🏓 Pong!", description: null }).addFields(
                { name: "Bot Latency", value: `${latency}ms`, inline: true },
                { name: "API Latency", value: `${apiLatency}ms`, inline: true },
                { name: "CPU Usage", value: `${cpu}%`, inline: true },
                { name: "RAM Usage", value: `${ram.used}GB / ${ram.total}GB (${ram.percentage}%)`, inline: true },
                { name: "Disk Usage", value: `Used: ${disk.used}, Available: ${disk.available}`, inline: true },
            );

            await InteractionHelper.safeEditReply(interaction, {
                content: null,
                embeds: [embed],
            });
        } catch (error) {
            logger.error('Ping command error:', error);
            try {
                return await InteractionHelper.safeReply(interaction, {
                    embeds: [createEmbed({ title: 'System Error', description: 'Could not determine latency at this time.', color: 'error' })],
                    flags: MessageFlags.Ephemeral,
                });
            } catch (replyError) {
                logger.error('Failed to send error reply:', replyError);
            }
        }
    },
};
