import { ButtonInteraction, EmbedBuilder, Events, GuildMember, Interaction, Message, StageChannel, TextChannel } from "discord.js";
import { APPLICATION_ROW, APPLICATION_STATUS, BUTTON_IDS } from "../lib/constants";
import { cache, prisma } from "../lib/db";
import { logger } from "../lib/logger";
import { Responses } from "../types/types";
import { Application } from "@prisma/client";
const wait = require("node:timers/promises").setTimeout;

module.exports = {
  name: Events.InteractionCreate,
  once: true,
  async execute(interaction: Interaction) {
    try {
      if (
        !interaction.isButton() ||
        interaction.member!.user.bot ||
        interaction.customId !== BUTTON_IDS.APPLY
      )
        return;

      const timeout = await cache.get(`timeout::${interaction.user.id}`);

      await interaction.deferReply({ ephemeral: true });

      if (timeout) {
        await wait(5000); // Just to discourage spam
        return interaction.editReply({
          content: `Please wait for ${interaction.client.config.applications.timeout} minutes after your application to apply again thank you.`,
        });
      }

      const application = await prisma.application.findFirst({
        where: {
          discord_id: interaction.user.id,
        },
      });

      if (application && application.status === APPLICATION_STATUS.PENDING) {
        await wait(5000); // Just to discourage spam
        return interaction.editReply({
          content: `You have already applied. Please wait for your application to be reviewed.`,
        });
      }

      await cache.set(
        `timeout::${interaction.user.id}`,
        true,
        interaction.client.config.applications.timeout * 60000,
      );

      sendQuestions(interaction as ButtonInteraction);
    } catch (error) {
      logger.error(error);
    }
  },
};

async function sendQuestions(interaction: ButtonInteraction) {
  try {
    const member = interaction.member as GuildMember;

    const questions = interaction.client.config.applications.questions;

    await interaction.editReply({ content: "Check your direct messages" })

    wait(10000).then(async () => {
      await interaction.deleteReply();
    });

    let index = 0;

    const responses: Responses = [];

    const filter = (m: Message) => m.author.id === member.id;

    while (index < questions.length) {
      const question = questions[index++];

      const embed = new EmbedBuilder().setTitle(`Question: ${index}`).setDescription(question).setColor('Aqua').setTimestamp();

      const { channel } = await member.send({ embeds: [embed] })

      if (channel instanceof StageChannel) return;

      const collector = channel.createMessageCollector({ filter });

      await new Promise((resolve) => collector.once('collect', resolve));

      responses.push({
        question: question,
        content: collector.collected.first()!.content
      });
    }

    const reply = new EmbedBuilder().setTitle('Application Received').setColor('Yellow').setTimestamp();

    await member.send({ embeds: [reply] });

    const application = await prisma.application.create({
      data: {
        discord_id: member.id,
        status: APPLICATION_STATUS.PENDING,
        answers: responses
      }
    });

    sendApplication(interaction, responses, application);
  } catch (error) {
    interaction.followUp({
      content:
        'Something went wrong trying to send questions to your Direct Messages. If you have direct messages disabled from this server, please enable them and try again.',
      ephemeral: true
    });

    logger.error(error);
  }
}

async function sendApplication(interaction: ButtonInteraction, responses: Responses, application: Application) {
  try {
    const channel = await interaction.client.channels.fetch(interaction.client.config.applications.channel) as TextChannel;

    if (!channel) {
      Error('Applications Channel not found');

      return interaction.followUp({ content: `Something went wrong trying to send your application. Please contact an admin for help. Application ID ${application.id}`, ephemeral: true });
    }

    const member = interaction.member as GuildMember;

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

    await prisma.application.update({
      where: {
        id: application.id
      },
      data: {
        message_id: message.id
      }
    });

    await interaction.followUp({ content: 'Your application has been submitted. Please wait for your application to be reviewed.', ephemeral: true });
  } catch (error) {
    logger.error(error);
  }
}