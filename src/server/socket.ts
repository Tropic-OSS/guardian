import { EmbedBuilder, PermissionsBitField, TextChannel } from 'discord.js';
import { Server } from 'socket.io';
import { CONFIG } from '../lib/setup';
import { prisma } from './db';
import { logger } from '../lib/logger';
import { client } from '..';

type ServerBanEvent = {
	id: string;
	name: string;
	reason: string;
};

type BanEvent = {
	id: string;
	name: string;
	reason: string;
	admin: string;
};

type SessionEvent = {
	mojang_id: string;
	server_id: string;
};

type Success = {
	success: boolean;
	server_id: string;
	msg: string;
};

type Auth = {
	token: string;
	server_id: string;
};
export const io = new Server(CONFIG.api_port);

io.use(async (socket, next) => {
	const auth = socket.handshake.auth as Auth;

	const server = await prisma.server.findFirst({
		where: {
			server_id: auth.server_id
		}
	});

	if (!server) {
		const err = new Error('not authorized');
		err.message = 'Server is not registered';
		return next(err);
	}

	if (server.server_token !== auth.token) {
		const err = new Error('not authorized');
		err.message = 'Token is not valid';
		return next(err);
	}

	return next();
});

io.on('connection', (socket) => {
	socket.data.serverId = socket.handshake.auth.server_id;

	logger.info(`Socket connected: ${socket.id} | ${socket.data.serverId} ✅`);

	socket.join(CONFIG.client_id);

	socket.on('ban', async (msg: BanEvent) => {
		socket.to(CONFIG.client_id).emit('ban', msg);
		try {
			const guild = await client.guilds.fetch(CONFIG.guild_id).catch((error) => {
				logger.error(`Error while trying to fetch guild ${CONFIG.guild_id}: ${error}`);
				return null;
			});

			if (!guild) {
				logger.warn(`Guild ${CONFIG.guild_id} not found`);
				return io.emit('success', { success: false, msg: `Guild ${CONFIG.guild_id} not found` });
			}

			const admin = await prisma.member.findFirst({
				where: {
					mojang_id: msg.admin
				}
			})

			if (!admin) {
				return io.emit('success', { success: false, msg: `Admin ${msg.admin} not found` });
			}

			const discordAdmin = await guild.members.fetch(admin.discord_id).catch((error) => {
				logger.error(`Error while trying to fetch admin ${admin.discord_id}: ${error}`);
				return null;
			});

			if (!discordAdmin) {
				logger.warn(`Admin ${admin.discord_id} not found`);
				return io.emit('success', { success: false, msg: `Admin ${admin.discord_id} not found` });
			}

			if (!discordAdmin.permissions.has(PermissionsBitField.Flags.BanMembers)) {
				logger.warn(`User ${admin.discord_id} does not have permission to ban members`);
				return io.emit('success', { success: false, msg: `User ${admin.discord_id} does not have permission to ban members` });
			}

			const member = await prisma.member.findFirst({
				where: {
					mojang_id: msg.id
				}
			});

			if (!member) {
				logger.warn(`Member ${msg.id} not found`);
				return io.emit('success', { success: false, msg: `Member ${msg.id} not found` });
			}

			const discordMember = await guild.members.fetch(member.discord_id).catch((error) => {
				logger.error(`Error while trying to fetch member ${member.discord_id}: ${error}`);
				return null;
			});

			if (!discordMember) {
				logger.warn(`Member ${member.discord_id} not found`);
				return io.emit('success', { success: false, msg: `Member ${member.discord_id} not found` });
			}

			await discordMember.ban({ reason: msg.reason }).catch((error) => {
				logger.error(`Error while trying to ban member ${member.discord_id}: ${error}`);
				io.emit('success', { success: false, msg: `Discord member ${member.discord_id} could not be banned` });
				return null;
			});

			await prisma.member
				.delete({
					where: {
						mojang_id: msg.id
					}
				})
				.catch((error) => {
					logger.error(`Error while trying to delete member ${msg.id}: ${error}`);
					io.emit('success', { success: false, msg: `Failled to update database with banned player` });
					return null;
				});

			return io.emit('success', { success: true, msg: `Banned ${member.mojang_id}` });
		} catch (error) {
			logger.error(error);
			return;
		}
	});

	socket.on('server-ban', async (msg: ServerBanEvent) => {
		socket.to(CONFIG.client_id).emit('server-ban', msg);
		try {
			const guild = await client.guilds.fetch(CONFIG.guild_id).catch((error) => {
				logger.error(error);
				return null;
			});

			if (!guild) {
				logger.warn(`Guild ${CONFIG.guild_id} not found`);
				return io.emit('success', { success: false, msg: `Guild ${CONFIG.guild_id} not found` });
			}

			const member = await prisma.member.findFirst({
				where: {
					mojang_id: msg.id
				}
			});

			if (!member) {
				logger.warn(`Member ${msg.id} not found`);
				return io.emit('success', { success: false, msg: `Member ${msg.id} not found` });
			}

			const discordMember = await guild.members.fetch(member.discord_id).catch((error) => {
				logger.error(`Error while trying to fetch member ${member.discord_id}: ${error}`);
				return null;
			});

			if (!discordMember) {
				logger.warn(`Member ${member.discord_id} not found`);
				return io.emit('success', { success: false, msg: `Member ${member.discord_id} not found` });
			}

			await discordMember.ban({ reason: msg.reason }).catch((error) => {
				logger.error(`Error while trying to ban member ${member.discord_id}: ${error}`);
				io.emit('success', { success: false, msg: `Discord member ${member.discord_id} could not be banned` });
				return null;
			});

			await prisma.member
				.delete({
					where: {
						mojang_id: msg.id
					}
				})
				.catch((error) => {
					logger.error(`Error while trying to delete member ${msg.id}: ${error}`);
					io.emit('success', { success: false, msg: `Failled to update database with banned player` });
					return null;
				});

			return io.emit('success', { success: true, msg: `Banned ${member.mojang_id}` });
		} catch (error) {
			logger.error(error);
			return;
		}
	});

	socket.on('session-start', async (msg: SessionEvent) => {
		socket.to(CONFIG.client_id).emit('session-start', msg);
		try {

			await prisma.session.create({
				data: {
					server_id: msg.server_id,
					mojang_id: msg.mojang_id
				}
			});

			return io.emit('success', { success: true, msg: `Started session for ${msg.mojang_id}` });
		} catch (error) {
			logger.error(`Error while trying to start session for ${msg.mojang_id}: ${error}`);
			return;
		}
	});

	socket.on('session-end', async (msg: SessionEvent) => {
		socket.to(CONFIG.client_id).emit('session-end', msg);

		try {
			const member = await prisma.member.findFirst({
				where: {
					mojang_id: msg.mojang_id
				}
			});

			if (!member) {
				logger.warn(`Member ${msg.mojang_id} not found`);
				return io.emit('success', { success: false, msg: `Member ${msg.mojang_id} not found` });
			}

			const session = await prisma.session.findFirst({
				where: {
					mojang_id: msg.mojang_id,
					server_id: msg.server_id,
					end_time: null
				},
				orderBy: {
					session_id: 'desc'
				}
			});

			if (!session) {
				logger.warn(`Session for ${member.mojang_id} not found`);
				return io.emit('success', { success: false, msg: `Session for ${member.mojang_id} not found` })
			};

			await prisma.session.update({
				where: {
					session_id: session.session_id
				},
				data: {
					end_time: new Date()
				}
			});

			return io.emit('success', { success: true, msg: `Ended session for ${member.mojang_id}` });
		} catch (error) {
			logger.error(error);
			return;
		}
	});

	socket.on('success', async (msg: Success) => {
		try {
			const console = (await client.channels.fetch(CONFIG.console_channel)) as TextChannel;

			if (!console) return;

			if (msg.success) {
				logger.info('Successfully sent event to server');

				const embed = new EmbedBuilder()
					.setColor('Green')
					.setTitle(`Success`)
					.setAuthor({
						name: 'Guardian',
						iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
					})
					.addFields({ name: 'Message', value: `${msg.msg}`, inline: true }, { name: 'Server ID', value: `${msg.server_id}`, inline: true })
					.setTimestamp();

				console.send({ embeds: [embed] });
				return;
			} else {
				logger.info('Failed to send event to server');

				const embed = new EmbedBuilder()
					.setColor('Red')
					.setTitle(`Error`)
					.setAuthor({
						name: 'Guardian',
						iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
					})
					.addFields({ name: 'Message', value: `${msg.msg}`, inline: true }, { name: 'Server ID', value: `${msg.server_id}`, inline: true })
					.setTimestamp();

				console.send({ embeds: [embed] });
				return;
			}
		} catch (error) {
			logger.error(`Error while trying to send success message: ${error}`);
			return;
		}
	});

	socket.on('disconnect', async () => {
		logger.info(`Socket disconnected: ${socket.id} || ${socket.data.serverId} ❌`);
		try {
			logger.info('Updating sessions');

			const session = await prisma.session.findFirst({
				where: {
					end_time: null,
					server_id: socket.data.serverId
				}
			});

			if (!session) return;

			await prisma.session.update({
				where: {
					session_id: session.session_id
				},
				data: {
					end_time: new Date()
				}
			});
		} catch (error) {
			logger.error(`Error while trying to update sessions: ${error}`);
			return;
		}
	});
});
