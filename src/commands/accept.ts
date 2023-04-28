import { client } from '..';
import { Command } from '@sapphire/framework';
import { send } from '@sapphire/plugin-editable-commands';
import { EmbedBuilder, Message, TextChannel } from 'discord.js';
import { ApplyOptions, RequiresGuildContext } from '@sapphire/decorators';
import { z } from 'zod';
import { db } from '../database/db';
import { CONFIG } from '../lib/setup';
import { io } from '../server/socket';

@ApplyOptions<Command.Options>({
	description: 'Accept Member',
	requiredUserPermissions: 'Administrator',
	options: []
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
		const application = await this.getApplicant(interaction.channelId!).catch(async (err) => {
			client.logger.error(err);
			await interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
		});

		if (!application)
			return await interaction.reply({ content: 'No application found', ephemeral: true }).catch(async (err) => {
				client.logger.error(err);
				await interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
			});

		const { value } = interaction.options.get('username', true);

		if (!value)
			return await interaction.reply({ content: 'No username provided', ephemeral: true }).catch(async (err) => {
				client.logger.error(err);
				await interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
			});

		const [member, mojangUser] = await Promise.all([
			await interaction.guild?.members.fetch(application.applicant_id).catch(async (err) => {
				client.logger.error(err);
				await interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
			}),
			await getMojangProfile(value.toString()).catch(async (err) => {
				client.logger.error(err);
				await interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
			})
		]);

		if (!member)
			return await interaction.reply({ content: 'Member not found', ephemeral: true }).catch(async (err) => {
				client.logger.error(err);
				await interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
			});

		if (!mojangUser)
			return interaction.reply({ content: 'Mojang user not found', ephemeral: true }).catch(async (err) => {
				client.logger.error(err);
				await interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
			});

		const [memberRole, interviewRole, acceptChannel] = await Promise.all([
			await interaction.guild?.roles.fetch(CONFIG.member_role).catch(async (err) => {
				client.logger.error(err);
				await interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
			}),
			await interaction.guild?.roles.fetch(CONFIG.interviews.role).catch(async (err) => {
				client.logger.error(err);
				await interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
			}),
			(await interaction.guild?.channels.fetch(CONFIG.accept_channel).catch(async (err) => {
				client.logger.error(err);
				await interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
				return;
			})) as TextChannel
		]);

		if (!memberRole || !interviewRole || !acceptChannel)
			return interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true }).catch(async (err) => {
				client.logger.error(err);
				await interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
			});

		await db
			.selectFrom('member')
			.where('discord_id', '=', member.id)
			.execute()
			.then(async (rows) => {
				if (rows.length > 0) {
					await interaction.reply({ content: 'Member already accepted', ephemeral: true });
					return;
				}
			})
			.catch((error) => {
				client.logger.error(error);
			});

		// Change to transaction

		await member.roles.remove(interviewRole).catch((error) => {
			client.logger.error(error);
			return interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
		});

		await member.roles.add(memberRole).catch((error) => {
			client.logger.error(error);
			return interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
		});

		await member.setNickname(member.displayName + `(${mojangUser.name})`).catch((error) => {
			client.logger.error(error);
			return interaction.reply({ content: 'Something went wrong trying to change nickname', ephemeral: true });
		});

		await acceptChannel.send(CONFIG.accept_message.replace('{member}', member.toString())).catch((error) => {
			client.logger.error(error);
			return interaction.reply({ content: 'Something went wrong trying to send message', ephemeral: true });
		});

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

		const event = {
			id: addDashes(mojangUser.id),
			name: mojangUser.name
		};

		io.emit('add', event);

		return await interaction.reply({ embeds: [embed] }).catch(async (err) => {
			client.logger.error(err);
			await interaction.reply({ content: 'Something went wrong trying to accept member', ephemeral: true });
		});
	}

	private async getApplicant(threadId: string) {
		const applicant = await db
			.selectFrom('application')
			.innerJoin('interview', 'interview.application_id', 'id')
			.select(['applicant_id', 'id'])
			.where('thread_id', '=', threadId)
			.executeTakeFirst()
			.catch(async (err) => {
				client.logger.error(err);
				return;
			});
		return applicant;
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
		client.logger.error(error);
		return null;
	}
}

function addDashes(id: string) {
	const regex = /([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]+)/g;
	const subst = '$1-$2-$3-$4-$5';
	const newId = id.replace(regex, subst);
	return newId;
}
