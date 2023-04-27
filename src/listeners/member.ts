import { EmbedBuilder, Events, GuildBan, GuildMember, TextChannel } from 'discord.js';
import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { z } from 'zod';
import { db } from '../database/db';
import { client } from '..';
import { io } from '../server/socket';
import { CONFIG } from '../lib/setup';

@ApplyOptions<Listener.Options>({ event: Events.GuildBanAdd, name: 'Handle Guild Member Ban' })
export class MemberBan extends Listener {
	public async run(ban: GuildBan) {
		const console = (await client.channels.fetch(CONFIG.console_channel)) as TextChannel;

		if (!console) return;

		try {
			await db
				.updateTable('member')
				.where('discord_id', '=', ban.user.id)
				.set({
					status: 'BANNED'
				})
				.executeTakeFirst();

			const memberProfile = await db.selectFrom('member').selectAll().where('discord_id', '=', ban.user.id).executeTakeFirst();

			if (!memberProfile) {
				client.logger.error(`Player ${ban.user.id} not found`);
				return;
			}

			const mojangProfile = await getMojangProfile(memberProfile.mojang_id);

			if (!mojangProfile) {
				client.logger.error(`Player ${ban.user.id} not found`);
				return;
			}

			const event = {
				id: addDashes(mojangProfile.id),
				name: mojangProfile.name
			};

			io.emit('ban', event);

			const embed = createEmbed('Member Banned', `Member ${ban.user.tag}`);
			console.send({ embeds: [embed] });
		} catch (error) {
			client.logger.error(error);
		}
	}
}

@ApplyOptions<Listener.Options>({ event: Events.GuildMemberRemove, name: 'Handle Guild Member Kick/Leave' })
export class MemberRemove extends Listener {
	public async run(member: GuildMember) {
		const console = (await client.channels.fetch(CONFIG.console_channel)) as TextChannel;

		if (!console) return;

		const embed = createEmbed('Member Left', `${member.user.tag} left the guild`);
		await removeMember(member);
		return console.send({ embeds: [embed] });
	}
}

async function removeMember(member: GuildMember) {
	try {
		await db
			.updateTable('member')
			.where('discord_id', '=', member.id)
			.set({
				status: 'LEFT'
			})
			.executeTakeFirst();

		const memberProfile = await db.selectFrom('member').selectAll().where('discord_id', '=', member.id).executeTakeFirst();

		if (!memberProfile) {
			client.logger.error(`Player ${member.id} not found`);
			return;
		}

		const mojangProfile = await getMojangProfile(memberProfile.mojang_id);

		if (!mojangProfile) {
			client.logger.error(`Player ${member.id} not found`);
			return;
		}
		const event = {
			id: addDashes(mojangProfile.id),
			name: mojangProfile.name
		};

		io.emit('leave', event);
	} catch (error) {
		client.logger.error(error);
	}
}

function createEmbed(name: string, msg: string) {
	const embed = new EmbedBuilder()
		.setColor('Blue')
		.setAuthor({
			name: 'Guardian',
			iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
		})
		.addFields({ name: name, value: `${msg}`, inline: true })
		.setTimestamp();

	return embed;
}

async function getMojangProfile(id: string) {
	const response = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`);

	if (response.status === 204 || response.status === 404) {
		return null;
	}

	const mojangProfileSchema = z.object({
		id: z.string(),
		name: z.string()
	});

	const data = mojangProfileSchema.parseAsync(await response.json());

	return data;
}

function addDashes(id: string) {
	const regex = /([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]+)/g;
	const subst = '$1-$2-$3-$4-$5';
	const newId = id.replace(regex, subst);
	return newId;
}
