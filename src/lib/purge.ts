import { EmbedBuilder, TextChannel } from 'discord.js';
import { sql } from 'kysely';
import { z } from 'zod';
import { client } from '..';
import { db } from '../database/db';
import { CONFIG } from './setup';

export async function purge() {
	try {
		const result = await sql<{ discord_id: string; mojang_id: string; grace_period_end: Date }>`SELECT discord_id, mojang_id, grace_period_end
		FROM member m
		LEFT JOIN session s ON m.id = s.member_id AND s.session_start >= DATE_SUB(NOW(), INTERVAL 60 DAY)
		WHERE s.id IS NULL AND m.status = 'ACTIVE';`.execute(db);

		client.logger.info(`Purging ${result.rows.length} sessions...`);

		const console = (await client.channels.fetch(CONFIG.console_channel)) as TextChannel;
		const guild = await client.guilds.fetch(CONFIG.guild_id);

		if (!console) return;

		if (!guild) return;

		if (result.rows.length === 0) {
			const embed = new EmbedBuilder()
				.setColor('Orange')
				.setAuthor({
					name: 'Guardian',
					iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
				})
				.setTitle('No members to purge')
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
				.addFields([{ name: 'Count', value: `${result.rows.length}`, inline: true }])
				.setTimestamp();
			await console.send({ embeds: [embed] });
		}

		result.rows.forEach(async (row) => {
			const mojangProfile = await getMojangProfile(row.mojang_id);

			if (Date.parse(row.grace_period_end.toDateString()) > Date.now()) {
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
						{ name: 'Grace Period End', value: `${row.grace_period_end.toDateString()}`, inline: true }
					])
					.setTimestamp();
				await console.send({ embeds: [embed] });
				return client.logger.info(`Skipping member ${row.discord_id} as they are in the grace period`);
			}

			await db
				.updateTable('member')
				.set({ status: 'LEFT' })
				.where('discord_id', '=', row.discord_id)
				.execute()
				.catch(async () => {
					client.logger.warn(`Failed to update member ${row.discord_id} to LEFT`);
					const embed = new EmbedBuilder()

						.setColor('Red')
						.setAuthor({
							name: 'Guardian',
							iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
						})
						.setTitle('Failed to Purge Member (Failed to Update Member Status in DB)')
						.addFields([
							{ name: 'Member ID', value: `<@${row.discord_id}>`, inline: true },
							{ name: 'Mojang', value: mojangProfile?.name ? `${mojangProfile.name}` : `<@${row.discord_id}>`, inline: true }
						])
						.setTimestamp();
					return await console.send({ embeds: [embed] });
				});

			const member = await guild.members.fetch(row.discord_id).catch(async () => {
				client.logger.warn(`Failed to fetch member ${row.discord_id}`);

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
				return;
			});

			if (!member) return;

			if (member.roles.cache.has(CONFIG.whitelist_manager.inactivity.vacation_role)) {
				client.logger.info(`Skipping member <@${member.id}> as they have the vacation role`);
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
				client.logger.warn(`Failed to send message to member <@${member.id}>`);
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
				client.logger.warn(`Failed to kick member ${member.id}`);

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

			await console.send({ embeds: [embed] });
		});
	} catch (error) {
		client.logger.error(error);
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
		client.logger.error(error);
		return null;
	}
}
