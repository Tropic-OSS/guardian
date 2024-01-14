import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { prisma } from "../../lib/db";
import { logger } from "../../lib/logger";
import { getMojangProfileByUsername } from "../../lib/mojang";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("accept")
    .setDescription("Accepts a member into the server.")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("The member to accept minecraft username.")
        .setRequired(true),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    try {
      interaction.deferReply({ ephemeral: true });

      if (!interaction.guild)
        return interaction.editReply(
          "This command can only be used in a server.",
        );

      if (interaction.user.bot) return;

      if (!interaction.memberPermissions?.has("Administrator"))
        return interaction.editReply(
          "You do not have permission to use this command.",
        );

      if (!interaction.client.config.interviews || !interaction.client.config.interviews?.enabled) {
        return interaction.editReply(
          "Interviews are not enabled on this server"
        )
      }

      if (!interaction.member)
        return interaction.editReply("Member not found.");

      if (!interaction.channel || !interaction.channel.isThread) return interaction.editReply("This command can only be ran in an interview channel thread")

      const memberRole = await interaction.guild?.channels.fetch(interaction.client.config.onboarding.acceptChannel)

      const interviewRole = await interaction.guild?.channels.fetch(interaction.client.config.interviews?.role ?? "")

      const acceptChannel = await interaction.guild?.channels.fetch(interaction.client.config.onboarding.acceptChannel)

      if (!memberRole) {
        logger.warn("Member Role Not Found")
        return interaction.editReply("Member role could not be found. Please check your config and try again")
      }

      if (!interviewRole) {
        logger.warn("Interview Role Not Found")
        return interaction.editReply("Interview role could not be found. Please check your config and try again")
      }

      if (!interviewRole) {
        logger.warn("Interview Role Not Found")
        return interaction.editReply("Interview role could not be found. Please check your config and try again")
      }

      if (!acceptChannel) {
        logger.warn("Accept Channel Not Found")
        return interaction.editReply("Accept Channel could not be found. Please check your config and try again")
      }

      const interview = await prisma.interview.findFirst({
        where: {
          thread_id: interaction.channel!.id,
        },
        include: {
          Application: true
        }
      });

      if (!interview)
        return await interaction.editReply("Interview could not be found");



      const { value } = interaction.options.get("target", true);

      const mojangProfile = await getMojangProfileByUsername(value as string)

      if (!mojangProfile) return await interaction.editReply("Mojang Profile could not be found. Please check the username provided and try again")

      await prisma.$transaction(async (tx) => {
        await tx.interview.update({
          where: {
            id: interview.id,
          },
          data: {
            status: "ACCEPTED",
            admin_id: interaction.user.id,
            reason: "Accepted into the server.",
          },
        });

        const interviewee = await interaction.guild!.members.fetch(interview.Application.discord_id as string);

        if (!interviewee) return interaction.editReply("Member not found.");

        await tx.member.upsert({
          create: {
            discord_id: interviewee.user.id,
            grace_period
          },
          update: {},
          where: {}
        })

      })

    } catch (error) {
      logger.error(error)
      interaction.editReply(
        "Something went wrong trying to accept member, if the problem persists go to your error logs and file a report on github"
      )
    }
  },
};
