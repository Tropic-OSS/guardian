import { ApplyOptions, RequiresGuildContext } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { send } from '@sapphire/plugin-editable-commands';
import { EmbedBuilder, Message } from 'discord.js';
import { client } from '..';
import { db } from '../database/db';

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
		try {
			const { value } = interaction.options.get('reason', true);

			const application = await this.getApplicant(interaction.channelId);

			if (!value) return interaction.reply({ content: 'Please provide a reason', ephemeral: true });

			if (application instanceof Error || !application)
				return interaction.reply({ content: 'Something went wrong trying to deny member', ephemeral: true });

			const member = await interaction.guild?.members.fetch(application.applicant_id);

			if (!member) return interaction.reply({ content: 'Member not found', ephemeral: true });

			await db
				.updateTable('interview')
				.set({ status: 'DENIED' })
				.where('thread_id', '=', interaction.channelId)
				.execute()
				.catch((error) => {
					client.logger.error(error);
					return interaction.reply({ content: 'Something went wrong trying to deny member', ephemeral: true });
				});

			await db
				.insertInto('application_meta')
				.values({
					id: application.id,
					admin_id: interaction.member!.user.id,
					response: value.toString()
				})
				.execute()
				.catch((error) => {
					client.logger.error(error);
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
				client.logger.error(error);
				return interaction.reply({ content: 'Something went wrong trying to denying member', ephemeral: true });
			});

			await member.kick(value.toString()).catch((error) => {
				client.logger.error(error);
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

			return await interaction.reply({ embeds: [embed] }).catch((error) => {
				client.logger.error(error);
				return interaction.reply({ content: 'Something went wrong trying to denying member', ephemeral: true });
			});
		} catch (error) {
			client.logger.error(error);
			return interaction.reply('Something went wrong');
		}
	}
	private async getApplicant(threadId: string) {
		const applicant = await db
			.selectFrom('application')
			.innerJoin('interview', 'interview.application_id', 'id')
			.select(['applicant_id', 'id'])
			.where('thread_id', '=', threadId)
			.executeTakeFirst();
		return applicant;
	}
}
