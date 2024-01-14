import { Events, Message, EmbedBuilder, TextChannel, } from "discord.js";
import { client } from "..";
import { logger } from "../lib/logger";
import { prisma } from "../lib/db";
import { APPLICATION_STATUS } from "../lib/constants";

module.exports = {
    name: Events.MessageDelete,
    async execute(message: Message) {

        const application = await prisma.application.findUnique({
            where: {
                message_id: message.id
            }
        });

        if (!application) {
            logger.warn(`Application not found for message ${message.id}`);
            return;
        }

        await prisma.application.update({
            where: {
                id: application.id
            },
            data: {
                status: APPLICATION_STATUS.DELETED
            }
        });

        const consoleChannel = (await client.channels.fetch(client.config.console_channel)) as TextChannel;

        if (!consoleChannel) {
            logger.warn("Console channel not found.")
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle(`Application Deleted`)
            .setAuthor({
                name: 'Guardian',
                iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
            })
            .addFields([
                { name: 'Application ID', value: `${application.id}`, inline: true },
                { name: 'Discord ID', value: `${application.discord_id}`, inline: true }
            ])
            .setTimestamp();

        return consoleChannel.send({ embeds: [embed] });
    }
};
