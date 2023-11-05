import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { ButtonInteraction, ChannelType, EmbedBuilder, Events, GuildMember, Interaction, TextChannel } from 'discord.js';
import { ACCEPTED_MEMBER_ROW, APPLICATION_STATUS, BUTTON_IDS, INTERVIEW_STATUS } from '../lib/constants';
import { CONFIG } from '../lib/setup';
import { logger } from '../lib/logger';
import { prisma } from '../server/db';

@ApplyOptions<Listener.Options>({ event: Events.InteractionCreate, name: 'Accept Member' })
export class AcceptButtonEvent extends Listener {
	public async run(interaction: Interaction) {
		if (!interaction.isButton() || interaction.member?.user.bot || interaction.customId !== BUTTON_IDS.ACCEPT) return;

		try {
			const data = await prisma.application.findUnique({ where: { application_id: interaction.message.id } });

			if (!data) return interaction.reply({ content: 'Could not find application in database', ephemeral: true });

			const applicant = await interaction.guild?.members.fetch(data.member_id);

			if (!applicant) return interaction.reply({ content: 'Could not find applicant in guild', ephemeral: true });

			return this.createInterview(applicant, interaction);
		} catch (error) {
			logger.error(error);
			return interaction.reply({
				content: 'Something went wrong, if the problem continues please report the problem including the error logs on Github',
				ephemeral: true
			});
		}
	}

	private async createInterview(applicant: GuildMember, interaction: ButtonInteraction) {
		try {
			const settings = {
				interviewRole: CONFIG.interviews.role,
				interviewChannel: CONFIG.interviews.channel,
				interviewMessage: CONFIG.interviews.notification
			};

			const role = await applicant.guild.roles.fetch(settings.interviewRole);

			const channel = (await applicant.guild.channels.fetch(settings.interviewChannel)) as TextChannel;

			const notification = settings.interviewMessage.replace(/{member}/g, applicant.toString());

			await applicant.roles.add(role!);

			await applicant.send(`You have been accepted for an interview in ${channel}!`);

			const thread = await channel.threads.create({
				name: `${applicant.user.tag}`,
				reason: 'Member Application accepted',
				type: ChannelType.PrivateThread
			});

			await prisma.application.update({
				where: { application_id: interaction.message.id },
				data: {
					application_status: APPLICATION_STATUS.ACCEPTED,
					interview_thread_id: thread.id,
					interview_status: INTERVIEW_STATUS.SCHEDULED
				}
			});

			await thread.members.add(applicant);

			await thread.send(notification);

			const admin = interaction.member as GuildMember;

			if (!admin) return interaction.reply({ content: 'Could not find admin', ephemeral: true });

			await thread.members.add(admin);

			const newEmbed = EmbedBuilder.from(interaction.message.embeds[0])
				.setColor('Green')
				.setTimestamp()
				.setFooter({ text: `Member accepted by ${interaction.member!.user.username}` });

			return await interaction.update({ embeds: [newEmbed], components: [ACCEPTED_MEMBER_ROW] });
		} catch (error) {
			logger.error(error);
			return await interaction.reply({ content: 'Could not create interview', ephemeral: true });
		}
	}
}
