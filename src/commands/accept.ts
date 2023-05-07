import { Command } from '@sapphire/framework';
import { send } from '@sapphire/plugin-editable-commands';
import { EmbedBuilder, Message, TextChannel } from 'discord.js';
import { ApplyOptions, RequiresGuildContext } from '@sapphire/decorators';
import { z } from 'zod';
import { prisma } from '../server/db';
import { logger } from '../lib/logger';
import { CONFIG } from '../lib/setup';
import { APPLICATION_STATUS, INTERVIEW_STATUS, MEMBER_STATUS } from '../lib/constants';
import { io } from '../server/socket';

@ApplyOptions<Command.Options>({
	description: 'Accept Member',
	requiredUserPermissions: 'Administrator'
})
export class UserCommand extends Command {
	// Register slash and context menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Register slash command
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('accept')
				.setDescription('Accept Member')
				.addStringOption((option) => option.setName('username').setDescription('Minecraft username for the user').setRequired(true))
		);
	}

	@RequiresGuildContext((message: Message) => send(message, 'This command can only be used in servers'))
	public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (interaction.member?.user.bot) return interaction.reply('Bots cannot accept members');

		const memberApplication = await prisma.application.findFirst({
			where: {
				interview_thread_id: interaction.channel!.id
			}
		});

		if (!memberApplication) {
			return await interaction.reply({ content: 'Application could not be found', ephemeral: true }).catch(async (err) => {
				logger.error(err);
			});
		}

		const { value } = interaction.options.get('username', true);

		try {
			const [member, mojangUser] = await Promise.all([
				interaction.guild!.members.fetch(memberApplication.member_id),
				getMojangProfile(value!.toString())
			]);

			if (!member || !mojangUser) {
				return await interaction.reply({ content: 'Member or Mojang User could not be found', ephemeral: true });
			}

			const memberRole = await interaction.guild!.roles.fetch(CONFIG.member_role).catch(async (err) => {
				logger.error(err);
				await interaction.reply({
					content:
						'Something went wrong trying to accept member, if the problem persists go to your error logs and file a report on github',
					ephemeral: true
				});
			});
			const interviewRole = await interaction.guild!.roles.fetch(CONFIG.interviews.role).catch(async (err) => {
				logger.error(err);
				await interaction.reply({
					content:
						'Something went wrong trying to accept member, if the problem persists go to your error logs and file a report on github',
					ephemeral: true
				});
			});

			const acceptChannel = (await interaction.guild!.channels.fetch(CONFIG.accept_channel).catch(async (err) => {
				logger.error(err);
				await interaction.reply({
					content:
						'Something went wrong trying to accept member, if the problem persists go to your error logs and file a report on github',
					ephemeral: true
				});
			})) as TextChannel;

			if (!memberRole || !interviewRole || !acceptChannel)
				return await interaction
					.reply({
						content:
							'Something went wrong trying to accept member, if the problem persists go to your error logs and file a report on github',
						ephemeral: true
					})
					.catch(async (err) => {
						logger.error(err);
					});

			await prisma
				.$transaction([
					prisma.member.upsert({
						where: {
							mojang_id: addDashes(mojangUser.id)
						},
						update: {
							mojang_id: addDashes(mojangUser.id),

							discord_id: member.id,
							grace_period: new Date(Date.now() + 1000 * 60 * 60 * 24 * CONFIG.whitelist_manager.inactivity.grace_period_days),
							status: MEMBER_STATUS.ACTIVE
						},
						create: {
							mojang_id: addDashes(mojangUser.id),
							status: MEMBER_STATUS.ACTIVE,
							discord_id: member.id,
							grace_period: new Date(Date.now() + 1000 * 60 * 60 * 24 * CONFIG.whitelist_manager.inactivity.grace_period_days)
						}
					}),
					prisma.application.update({
						where: {
							application_id: memberApplication.application_id
						},
						data: {
							application_status: APPLICATION_STATUS.ACCEPTED,
							interview_status: INTERVIEW_STATUS.ACCEPTED
						}
					})
				])
				.catch(async (err) => {
					logger.error(err);
					return await interaction.reply({
						content:
							'Something went wrong trying to accept member, if the problem persists go to your error logs and file a report on github',
						ephemeral: true
					});
				});

			await member.roles.add(memberRole);

			await member.roles.remove(interviewRole);

			await member.setNickname(member.displayName + `(${mojangUser.name})`);

			await acceptChannel.send(CONFIG.accept_message.replace('{member}', member.toString()));

			const event = {
				id: addDashes(mojangUser.id),
				name: mojangUser.name
			};

			io.emit('add', event);

			const embed = new EmbedBuilder()
				.setColor('#0099ff')
				.setTitle(`Link Created and Member Accepted`)
				.setAuthor({
					name: 'Guardian',
					iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
				})
				.addFields({ name: 'Discord Name', value: `${member}`, inline: true }, { name: 'IGN', value: `${mojangUser.name}`, inline: true })
				.setImage(`https://crafatar.com/renders/body/${mojangUser.id}?scale=3`)
				.setTimestamp();

			return await interaction.reply({ embeds: [embed] }).catch(async (err) => {
				logger.error(err);
				await interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
			});
		} catch (error) {
			logger.error(error);
			return await interaction.reply({ content: 'Member or Mojang User could not be found', ephemeral: true });
		}
	}
}

async function getMojangProfile(username: string) {
	try {
		const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);

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

function addDashes(id: string) {
	const regex = /([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]+)/g;
	const subst = '$1-$2-$3-$4-$5';
	const newId = id.replace(regex, subst);
	return newId;
}
