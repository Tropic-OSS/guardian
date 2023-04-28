import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { ButtonInteraction, EmbedBuilder, Events, GuildMember, Interaction, Message, StageChannel, TextChannel } from 'discord.js';
import { client } from '..';
import { timeoutCache } from '../database/db';
import { APPLICATION_ROW, APPLICATION_STATUS, BUTTON_IDS } from '../lib/constants';
import { CONFIG } from '../lib/setup';
import type { Responses } from '../lib/types';
import { logger } from '../lib/logger';
import { prisma } from '../server/db';
const wait = require('node:timers/promises').setTimeout;

@ApplyOptions<Listener.Options>({ event: Events.InteractionCreate, name: 'Member Apply' })
export class ApplyButtonEvent extends Listener {
	public async run(interaction: Interaction) {
		try {
			if (!interaction.isButton() || interaction.member!.user.bot || interaction.customId !== BUTTON_IDS.APPLY) return;

			const checkTimeout = await timeoutCache.get(interaction.user.id);

			const application = await prisma.application.findFirst({
				where: {
					member_id: interaction.user.id
				}
			});

			if (application && application.application_status === APPLICATION_STATUS.PENDING) {
				await interaction.deferReply({ ephemeral: true });
				await wait(5000);
				return interaction.editReply({
					content: 'You already have an application pending, please wait for a staff member to review your application'
				});
			}

			if (checkTimeout) {
				await interaction.deferReply({ ephemeral: true });
				await wait(5000);
				interaction.editReply({
					content: `Please wait for ${CONFIG.applications.timeout} minutes after your application to apply again thank you`
				});
			}
			await timeoutCache.set(interaction.user.id, true, CONFIG.applications.timeout * 60000);

			return this.sendQuestions(interaction);
		} catch (error) {
			logger.error(error);
		}
	}

	private async sendQuestions(interaction: ButtonInteraction) {
		const member = interaction.member as GuildMember;

		const questions = CONFIG.applications.questions;

		await interaction.reply({ content: 'Check your direct messages', ephemeral: true }).catch((error) => {
			client.logger.error(error);
			return interaction.reply({
				content:
					'Something went wrong trying to send questions to your Direct Messages. If you have direct messages disabled from this server, please enable them and try again.',
				ephemeral: true
			});
		});

		let index = 0;

		const responses: Responses = [];

		const filter = (m: Message) => m.author.id === member.id;

		while (index < questions.length) {
			const question = questions[index++];

			const embed = new EmbedBuilder().setTitle(`Question: ${index}`).setDescription(question).setColor('Aqua').setTimestamp();

			const { channel } = await member.send({ embeds: [embed] });

			if (channel instanceof StageChannel) return;

			const collector = channel.createMessageCollector({ filter });

			await new Promise((resolve) => collector.once('collect', resolve));

			responses.push({
				question: question,
				content: collector.collected.first()!.content
			});
		}

		const reply = new EmbedBuilder().setTitle('Application Received').setColor('Yellow').setTimestamp();

		await member.send({ embeds: [reply] }).catch((error) => {
			client.logger.error(error);
			return interaction.reply({ content: 'Sorry, something went wrong', ephemeral: true });
		});

		return this.postApplication(responses, member);
	}

	async postApplication(responses: Responses, member: GuildMember) {
		const channel = (await client.channels.fetch(CONFIG.applications.channel)) as TextChannel;

		//TODO Log error
		if (!channel) return;

		const fields = responses.map(({ question, content }) => {
			return {
				name: question,
				value: content,
				inline: false
			};
		});

		const embed = new EmbedBuilder()
			.setColor('Yellow')
			.setAuthor({
				name: member.displayName,
				iconURL: member.user.displayAvatarURL({ forceStatic: false })
			})
			.setTitle(`${member.user.tag} has submitted an application`)
			.setThumbnail(member.displayAvatarURL({ forceStatic: false }))
			.setFields(fields)
			.setTimestamp();

		const message = await channel.send({
			embeds: [embed],
			components: [APPLICATION_ROW]
		});

		await prisma.application.create({
			data: {
				application_id: message.id,
				member_id: member.id,
				application_status: APPLICATION_STATUS.PENDING,
				application_answers: JSON.stringify(responses)
			}
		});
	}
}
