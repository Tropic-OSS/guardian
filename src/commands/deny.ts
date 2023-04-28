import { ApplyOptions, RequiresGuildContext } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { send } from '@sapphire/plugin-editable-commands';
import { EmbedBuilder, Message } from 'discord.js';
import { prisma } from '../server/db';
import { INTERVIEW_STATUS } from '../lib/constants';
import { logger } from '../lib/logger';

@ApplyOptions<Command.Options>({
	description: 'Deny Member',
	requiredUserPermissions: 'Administrator',
	options: []
})
export class UserCommand extends Command {
	// Register slash and context menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Register slash command
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('deny')
				.setDescription('Deny Member')
				.addStringOption((option) => option.setName('reason').setDescription('Reason for denying member').setRequired(true))
		);
	}

	@RequiresGuildContext((message: Message) => send(message, 'This command can only be used in servers'))
	public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (interaction.member!.user.bot) return interaction.reply('Bots cannot deny members');

		const { value } = interaction.options.get('reason', true);

		const application = await prisma.application.findUnique({
			where: {
				interview_thread_id: interaction.channelId
			}
		});

		if (!application) {
			return interaction.reply({ content: 'Something went wrong trying to deny member, is this an interview thread ?', ephemeral: true });
		}

		const member = await interaction.guild?.members.fetch(application.member_id);

		if (!member) return interaction.reply({ content: 'Member not found', ephemeral: true });

		await prisma.application
			.update({
				where: {
					interview_thread_id: interaction.channelId
				},
				data: {
					interview_status: INTERVIEW_STATUS.DENIED
				}
			})
			.catch((error) => {
				logger.error(error);
				return interaction.reply({ content: 'Something went wrong trying to deny member', ephemeral: true });
			});

		const denyEmbed = new EmbedBuilder()
			.setColor('Red')
			.setTitle(`Denied`)
			.setAuthor({
				name: 'Guardian',
				iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
			})
			.addFields({ name: 'Reason', value: `${value}`, inline: true })
			.setTimestamp();

		await member.send({ embeds: [denyEmbed] }).catch((error) => {
			logger.error(error);
			return interaction.reply({ content: 'Something went wrong trying to denying member', ephemeral: true });
		});

		await member.kick(value!.toString()).catch((error) => {
			logger.error(error);
			return interaction.reply({ content: 'Something went wrong trying to denying member', ephemeral: true });
		});

		const embed = new EmbedBuilder()
			.setColor('Red')
			.setTitle(`Applicant Denied`)
			.setAuthor({
				name: 'Guardian',
				iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
			})
			.addFields({ name: 'Member', value: `${member}`, inline: true }, { name: 'Reason', value: `${value}`, inline: true })
			.setTimestamp();

		return await interaction.reply({ embeds: [embed] });
	}
}
