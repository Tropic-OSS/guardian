import { EmbedBuilder, TextChannel } from 'discord.js';
import { z } from 'zod';
import { CONFIG } from './setup';
import { client } from '..';
import { logger } from './logger';
import { prisma } from '../server/db';
import { MEMBER_STATUS } from './constants';

export async function purge() {
	try {
		const cutoffDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
		
		const inactiveMembers = await prisma.member.findMany({
			where: {
			  sessions: {
				some: {
				  end_time: {
					lt: cutoffDate,
				  },
				},
			  },
			},
		  });

		logger.info(`Purging ${inactiveMembers.length} sessions...`);

		const console = (await client.channels.fetch(CONFIG.console_channel)) as TextChannel;
		const guild = await client.guilds.fetch(CONFIG.guild_id);

		if (!console) return;

		if (!guild) return;

		if (inactiveMembers.length === 0) {
			const embed = new EmbedBuilder()
				.setColor('Orange')
				.setAuthor({
					name: 'Guardian',
					iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
				})
				.setTitle('No members to purge')
				.setImage("https://media2.giphy.com/media/7SF5scGB2AFrgsXP63/giphy.gif")
				.setTimestamp();
			await console.send({ embeds: [embed] });
		} else {
			const embed = new EmbedBuilder()
				.setColor('Orange')
				.setAuthor({
					name: 'Guardian',
					iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
				})
				.setTitle('Purging Members')
				.addFields([{ name: 'Count', value: `${inactiveMembers.length}`, inline: true }])
				.setImage("https://media.tenor.com/jg0-zHyA_8oAAAAi/winnie-the-pooh-pooh-bear.gif")
				.setTimestamp();
			await console.send({ embeds: [embed] });
		}

		inactiveMembers.forEach(async (row) => {
			const mojangProfile = await getMojangProfile(row.mojang_id);

			if (Date.parse(row.grace_period.toDateString()) > Date.now()) {
				const embed = new EmbedBuilder()
					.setColor('Orange')
					.setAuthor({
						name: 'Guardian',
						iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
					})
					.setTitle('Skipping Member (Grace Period)')
					.addFields([
						{ name: 'Member ID', value: `<@${row.discord_id}>`, inline: true },
						{ name: 'Mojang', value: mojangProfile?.name ? `${mojangProfile.name}` : `<@${row.discord_id}>`, inline: true },
						{ name: 'Grace Period End', value: `${row.grace_period.toDateString()}`, inline: true }
					])
					.setTimestamp();
				await console.send({ embeds: [embed] });
				return logger.info(`Skipping member ${row.discord_id} as they are in the grace period`);
			}
				
			await prisma.member.update({
				where:{
					mojang_id: row.mojang_id
				},
				data: {
					status: MEMBER_STATUS.INACTIVE
				}
			})

			const member = await guild.members.fetch(row.discord_id).catch(async () => {
				logger.warn(`Failed to fetch member ${row.discord_id}`);

				const embed = new EmbedBuilder()
					.setColor('Red')
					.setAuthor({
						name: 'Guardian',
						iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
					})
					.setTitle('Failed to Purge Member (Member Not Found)')
					.addFields([
						{ name: 'Member ID', value: `<@${row.discord_id}>`, inline: true },
						{ name: 'Mojang', value: mojangProfile?.name ? `${mojangProfile.name}` : `<@${row.discord_id}>`, inline: true }
					])
					.setTimestamp();

				 await console.send({ embeds: [embed] });
				 return
			});

			if (!member) return;

			if (member.roles.cache.has(CONFIG.whitelist_manager.inactivity.vacation_role)) {
				logger.info(`Skipping member <@${member.id}> as they have the vacation role`);
				const embed = new EmbedBuilder()
					.setColor('Blue')
					.setAuthor({
						name: 'Guardian',
						iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
					})
					.setTitle('Skipping Member (Vacation)')
					.addFields([
						{ name: 'Member ID', value: `<@${member.id}>`, inline: true },
						{ name: 'Mojang', value: mojangProfile?.name ? `${mojangProfile.name}` : `<@${row.discord_id}>`, inline: true }
					])
					.setTimestamp();

				await console.send({ embeds: [embed] });
				return;
			}

			await member.send(CONFIG.whitelist_manager.inactivity.message).catch(async () => {
				logger.warn(`Failed to send message to member <@${member.id}>`);
				const embed = new EmbedBuilder()
					.setColor('Red')
					.setAuthor({
						name: 'Guardian',
						iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
					})
					.setTitle('Failed to Send Member Kick Message (DMs Disabled)')
					.addFields([
						{ name: 'Member ID', value: `<@${member.id}>`, inline: true },
						{ name: 'Mojang', value: mojangProfile?.name ? `${mojangProfile.name}` : `<@${row.discord_id}>`, inline: true }
					])
					.setTimestamp();

				await console.send({ embeds: [embed] });
				return;
			});

			await member.kick('Inactive').catch(async () => {
				logger.warn(`Failed to kick member ${member.id}`);

				const embed = new EmbedBuilder()
					.setColor('Red')
					.setAuthor({
						name: 'Guardian',
						iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
					})
					.setTitle('Failed to Kick Member (Insufficient Permissions)')
					.addFields([
						{ name: 'Member ID', value: `<@${member.id}>`, inline: true },
						{ name: 'Mojang', value: mojangProfile?.name ? `${mojangProfile.name}` : `<@${row.discord_id}>`, inline: true }
					])
					.setTimestamp();

				await console.send({ embeds: [embed] });
				return;
			});

			const embed = new EmbedBuilder()
				.setColor('Blue')
				.setAuthor({
					name: 'Guardian',
					iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
				})
				.setTitle('Member Purged (Inactive)')
				.setImage(member.user.displayAvatarURL())
				.addFields([
					{ name: 'Member ID', value: `<@${member.id}>`, inline: true },
					{ name: 'Member Name', value: `${member.displayName}`, inline: true },
					{ name: 'Mojang', value: mojangProfile?.name ? `${mojangProfile.name}` : `<@${row.discord_id}>`, inline: true }
				])
				.setTimestamp();

			return await console.send({ embeds: [embed] });
		});
	} catch (error) {
		logger.error(error);
		return;
	}
}

async function getMojangProfile(id: string) {
	try {
		const response = await fetch(`https://api.mojang.com/user/profile/${id}`);

		if (response.status === 204 || response.status === 404) {
			return null;
		}

		const MojangProfileSchema = z.object({
			id: z.string(),
			name: z.string()
		});

		const data = MojangProfileSchema.parseAsync(await response.json());

		return data;
	} catch (error) {
		logger.error(error);
		return null;
	}
}
