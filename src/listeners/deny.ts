import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ButtonInteraction,
	EmbedBuilder,
	Events,
	GuildMember,
	ModalActionRowComponentBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	type Interaction
} from 'discord.js';
import { client } from '..';
import { db } from '../database/db';
import { APPLICATION_ROW, BUTTON_IDS, DISABLED_APPLICATION_ROW, MODAL_IDS } from '../lib/constants';

@ApplyOptions<Listener.Options>({ event: Events.InteractionCreate, name: 'Deny Member' })
export class DenyButtonEvent extends Listener {
	public async run(interaction: Interaction) {
		if (!interaction.isButton() || interaction.member?.user.bot || interaction.customId !== BUTTON_IDS.DENY) return;

		try {
			const application = await db
				.selectFrom('application')
				.select(['id', 'applicant_id'])
				.where('id', '=', interaction.message.id)
				.executeTakeFirst();

			if (!application) return interaction.reply({ content: 'Could not find application in database', ephemeral: true });

			const modal = new ModalBuilder().setCustomId(MODAL_IDS.REASON).setTitle('Guardian');

			const member = await interaction.guild?.members.fetch(application.applicant_id);

			if (!member) return interaction.reply('Member could not be found. Are they still in the server ?');

			const applicationMessage = interaction.message;

			const reasonInput = new TextInputBuilder()
				.setCustomId(MODAL_IDS.ADMIN_REASON)
				.setLabel(`Reason for denying ${member.user.tag}`)
				.setStyle(TextInputStyle.Paragraph)
				.setMaxLength(1000)
				.setMinLength(10);

			const textInput = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(reasonInput);

			modal.addComponents(textInput);

			applicationMessage.edit({ components: [DISABLED_APPLICATION_ROW] });

			const notification = await applicationMessage.reply(`Application is being responded to by ${interaction.user}`);

			interaction.showModal(modal);

			const submitted = await interaction
				.awaitModalSubmit({
					time: 60000,
					filter: (i) => i.user.id === interaction.user.id
				})
				.catch(() => {
					applicationMessage.edit({ components: [APPLICATION_ROW] });
					notification.delete();
					return null;
				});

			if (!submitted) return;

			notification.delete();

			await submitted.reply({ content: 'Your submission was received successfully!', ephemeral: true });

			const reason = submitted.fields.getTextInputValue(MODAL_IDS.ADMIN_REASON);

			return this.denyApplicant(interaction, reason, application.id, application.applicant_id);
		} catch (error) {
			client.logger.error(error);
			return interaction.reply({ content: 'An error occured while fetching the application', ephemeral: true });
		}
	}

	async denyApplicant(interaction: ButtonInteraction, response: string, applicationId: string, applicantId: string) {
		try {
			await db
				.insertInto('application_meta')
				.values({
					id: applicationId,
					response: response,
					admin_id: interaction.user.id
				})
				.execute();

			await db.updateTable('application').set({ status: 'DENIED' }).where('id', '=', applicationId).execute();

			const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor('Red')
				.setFooter({
					text: `User Denied by ${interaction.user.username}\nReason: ${response}\n`
				});
			interaction.message.edit({ embeds: [newEmbed], components: [] });
			const admin = interaction.member as GuildMember;

			const embed = new EmbedBuilder()
				.setColor('Orange')
				.setAuthor({
					name: 'Guardian',
					iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png?size=100'
				})
				.setTitle(`${admin.user.tag} Denied your application`)
				.setThumbnail(admin.displayAvatarURL({ forceStatic: false }))
				.setImage('https://media.tenor.com/xsOPyZLcxD8AAAAi/rabbit-animal.gif')
				.setDescription(response)
				.setTimestamp();

			const applicant = await interaction.guild?.members.fetch(applicantId);

			if (!applicant) return 'Member could not be found. Are they still in the server ?';

			return await applicant.send({ embeds: [embed] });
		} catch (error) {
			client.logger.error(error);
			return interaction.reply({ content: 'An error occured while denying the application', ephemeral: true });
		}
	}
}
