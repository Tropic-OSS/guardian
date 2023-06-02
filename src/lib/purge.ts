import { EmbedBuilder, TextChannel } from 'discord.js';
import { z } from 'zod';
import { CONFIG } from './setup';
import { client } from '..';
import { logger } from './logger';
import { prisma } from '../server/db';

export async function purge() {
	try {
		const cutoffDate = new Date();

		cutoffDate.setDate(cutoffDate.getDate() - CONFIG.whitelist_manager.inactivity.remove_inactive_player_after_days);

		const inactiveMembers = await prisma.member.findMany({
			where: {
				NOT: {
					sessions: {
						some: {
							start_time: {
								gte: cutoffDate.toISOString()
							}
						}
					}
				}
			}
		});

		logger.info(`Purging ${inactiveMembers.length} members...`);

		const consoleChannel = (await client.channels.fetch(CONFIG.console_channel)) as TextChannel;

		if (!consoleChannel) return;

		const guild = await client.guilds.fetch(CONFIG.guild_id);

		if (!guild) return;

		inactiveMembers.forEach(async (row) => {
			const mojangProfile = await getMojangProfile(row.mojang_id);

			if (Date.parse(row.grace_period.toDateString()) > Date.now()) {
				return logger.info(`Skipping member ${row.discord_id} as they are in the grace period`);
			}

			const member = await guild.members.fetch(row.discord_id).catch(async (error) => {
				logger.warn(`Failed to fetch member ${row.discord_id} : `, error);

				await prisma.member.delete({
					where: {
						mojang_id: row.mojang_id
					},
				});

				return
			});

			if (!member) return;

			if (member.roles.cache.has(CONFIG.whitelist_manager.inactivity.vacation_role)) {
				return logger.info(`Skipping member <@${member.id}> as they have the vacation role`);
			}

			await member.send(CONFIG.whitelist_manager.inactivity.message).catch(async () => {
				logger.warn(`Failed to send message to member <@${member.id}>`);
			});

			await member.kick('Inactive')

			await prisma.member.delete({
				where: {
					mojang_id: row.mojang_id
				}
			});

			const embed = new EmbedBuilder()
				.setColor('Blue')
				.setAuthor({
					name: 'Guardian',
					iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
				})
				.setTitle('Member Purged')
				.setImage(member.user.displayAvatarURL())
				.addFields([
					{ name: 'Member ID', value: `<@${member.id}>`, inline: true },
					{ name: 'Member Name', value: `${member.displayName}`, inline: true },
					{ name: 'Mojang', value: mojangProfile?.name ? `${mojangProfile.name}` : `<@${row.discord_id}>`, inline: true }
				])
				.setImage('https://media.tenor.com/5JmSgyYNVO0AAAAC/asdf-movie.gif')
				.setTimestamp();

			return await consoleChannel.send({ embeds: [embed] });
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
