import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { createEmbed } from '../../utils/embeds.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { withErrorHandling } from '../../utils/errorHandler.js';
import path from 'path';

export default {
    data: new SlashCommandBuilder()
        .setName('naomi')
        .setDescription('Shows a picture of Naomi'),

    execute: withErrorHandling(async (interaction) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const imagePath = path.join(process.cwd(), 'src', 'assets', 'images', 'naomi.png');
        const attachment = new AttachmentBuilder(imagePath, { name: 'naomi.png' });

        const embed = createEmbed({
            title: 'Naomi',
            image: 'attachment://naomi.png',
            color: 'primary'
        });

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed],
            files: [attachment]
        });
    }, { command: 'naomi' })
};
