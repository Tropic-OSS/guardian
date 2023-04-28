import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { EmbedBuilder, Events, Message, type TextChannel } from 'discord.js';
import { client } from '..';
import { CONFIG } from '../lib/setup';
import { prisma } from '../server/db';
import { APPLICATION_STATUS } from '../lib/constants';

@ApplyOptions<Listener.Options>({ event: Events.MessageDelete, name: 'Handle Message Deletion' })
export class MessageRemove extends Listener {
	public async run(message: Message) {
		const console = (await client.channels.fetch(CONFIG.console_channel)) as TextChannel;

		if (!console) return;

		const application = await prisma.application.update({
			where:{
				application_id: message.id
			},
			data: {
				application_status: APPLICATION_STATUS.DELETED,
			}
		})
		if (!application) return;

		const embed = new EmbedBuilder()
			.setColor('Red')
			.setTitle('Application Deleted')
			.setAuthor({
				name: 'Guardian',
				iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
			})
			.addFields([
				{ name: 'Application ID', value: `${application.application_id}`, inline: true },
				{ name: 'Member ID', value: `${application.member_id}`, inline: true }
			])
			.setTimestamp();

		return console.send({ embeds: [embed] });
	}
}
