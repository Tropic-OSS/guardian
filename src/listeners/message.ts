import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { EmbedBuilder, Events, Message, type TextChannel } from 'discord.js';
import { client } from '..';
import { db } from '../database/db';
import { CONFIG } from '../lib/setup';

@ApplyOptions<Listener.Options>({ event: Events.MessageDelete, name: 'Handle Message Deletion' })
export class MessageRemove extends Listener {
	public async run(message: Message) {
		const console = (await client.channels.fetch(CONFIG.console_channel)) as TextChannel;

		if (!console) return;

		const application = await db.selectFrom('application').selectAll().where('id', '=', message.id).executeTakeFirst();

		if (!application) return;

		const update = await db
			.updateTable('application_meta')
			.set({
				deleted: true
			})
			.where('id', '=', message.id)
			.executeTakeFirst();

		await db
			.updateTable('application')
			.set({
				status: 'DELETED'
			})
			.where('id', '=', message.id)
			.executeTakeFirst();

		if (update.numUpdatedRows == BigInt(0)) {
			await db
				.insertInto('application_meta')
				.values({
					id: message.id,
					admin_id: client.user!.id,
					response: 'Application was deleted',
					deleted: true
				})
				.execute();
		}

		const embed = new EmbedBuilder()
			.setColor('Red')
			.setTitle('Application Deleted')
			.setAuthor({
				name: 'Guardian',
				iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
			})
			.addFields([
				{ name: 'Application ID', value: `${application.id}`, inline: true },
				{ name: 'Member ID', value: `${application.applicant_id}`, inline: true }
			])
			.setTimestamp();

		return console.send({ embeds: [embed] });
	}
}
