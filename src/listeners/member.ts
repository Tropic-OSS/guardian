import { EmbedBuilder, Events, GuildBan, GuildMember, TextChannel } from 'discord.js';
import { Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';
import { z } from 'zod';
import { io } from '../server/socket';
import { CONFIG } from '../lib/setup';
import { logger } from '../lib/logger';
import { prisma } from '../server/db';
import { MEMBER_STATUS } from '../lib/constants';
import { client } from '..';

@ApplyOptions<Listener.Options>({ event: Events.GuildBanAdd, name: 'Handle Guild Member Ban' })
export class MemberBan extends Listener {
	public async run(ban: GuildBan) {
		const console = (await client.channels.fetch(CONFIG.console_channel)) as TextChannel;

		if (!console) return;

		try {
				const memberProfile = await prisma.member.update({
					where: {
						discord_id: ban.user.id
					},
					data: {
						status: MEMBER_STATUS.BANNED
					}
				})
			if (!memberProfile) {
				return logger.error(`Player ${ban.user.id} not found`);
			}

			const mojangProfile = await getMojangProfile(memberProfile.mojang_id);

			if (!mojangProfile) {
				return logger.error(`Player ${ban.user.id} not found`);
			}

			const event = {
				id: addDashes(mojangProfile.id),
				name: mojangProfile.name
			};

			io.emit('ban', event);

			const embed = createEmbed('Member Banned', `Member ${ban.user.tag}`);

			return console.send({ embeds: [embed] });
		} catch (error) {
			return logger.error(error);
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
			const memberProfile = await prisma.member.update({
				where: {
					discord_id: member.id
				},
				data: {
					status: MEMBER_STATUS.LEFT
				}
			})


		if (!memberProfile) {
			return logger.error(`Player ${member.id} not found`);
		}

		const mojangProfile = await getMojangProfile(memberProfile.mojang_id);

		if (!mojangProfile) {
			return logger.error(`Player ${member.id} not found`);
		}
		const event = {
			id: addDashes(mojangProfile.id),
			name: mojangProfile.name
		};

		return io.emit('leave', event);
	} catch (error) {
		return logger.error(error);
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
