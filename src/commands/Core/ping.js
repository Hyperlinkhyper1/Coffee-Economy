import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { pgDb } from '../../utils/postgresDatabase.js';

function getSystemResources() {
    // Disk Space - Project directory size and database size
    let diskInfo = { project: 'N/A', database: 'N/A' };
    try {
        // Calculate approximate project size
        function getDirectorySize(dirPath) {
            let totalSize = 0;
            const items = fs.readdirSync(dirPath);

            for (const item of items) {
                const itemPath = path.join(dirPath, item);
                const stats = fs.statSync(itemPath);

                if (stats.isDirectory()) {
                    // Skip node_modules and other large directories
                    if (item !== 'node_modules' && item !== '.git' && item !== 'assets') {
                        totalSize += getDirectorySize(itemPath);
                    }
                } else {
                    totalSize += stats.size;
                }
            }
            return totalSize;
        }

        const projectSize = getDirectorySize(process.cwd());
        const projectSizeMB = Math.round(projectSize / 1024 / 1024 * 100) / 100;
        diskInfo.project = `~${projectSizeMB}MB`;
    } catch (error) {
        diskInfo.project = 'Check host panel';
    }

    return {
        disk: diskInfo
    };
}

async function getDatabaseSize() {
    try {
        if (pgDb && pgDb.isAvailable()) {
            const dbSize = await pgDb.getDatabaseSize();
            if (dbSize) {
                // Convert bytes to MB
                const sizeInMB = Math.round((dbSize.bytes / 1024 / 1024) * 100) / 100;
                return `${sizeInMB} MB`;
            }
            return 'N/A';
        }
        return 'Memory Mode';
    } catch (error) {
        logger.error('Error getting database size for ping:', error);
        return 'Error';
    }
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

            const { disk } = getSystemResources();
            const databaseSize = await getDatabaseSize();

            const embed = createEmbed({ title: "🏓 Pong!", description: null }).addFields(
                { name: "Bot Latency", value: `${latency}ms`, inline: true },
                { name: "API Latency", value: `${apiLatency}ms`, inline: true },
                { name: "Disk Usage", value: `Project Size: ${disk.project}\nDatabase Size: ${databaseSize}`, inline: true },
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
