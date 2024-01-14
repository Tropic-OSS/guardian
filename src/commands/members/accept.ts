import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { prisma } from "../../lib/db";
import { logger } from "../../lib/logger";

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

      if (!interaction.member)
        return interaction.editReply("Member not found.");

      if (!interaction.memberPermissions?.has("Administrator"))
        return interaction.editReply(
          "You do not have permission to use this command.",
        );

      const memberApplication = await prisma.interview.findFirst({
        where: {
          thread_id: interaction.channel!.id,
        },
      });

      if (!memberApplication)
        return await interaction.editReply("Application could not be found");

      const { value } = interaction.options.get("target", true);

      const member = await interaction.guild.members.fetch(value as string);

      if (!member) return interaction.reply("Member not found.");

      await prisma.interview.update({
        where: {
          id: memberApplication.id,
        },
        data: {
          status: "ACCEPTED",
          admin_id: interaction.user.id,
          reason: "Accepted into the server.",
        },
      });
    } catch (error) {}
  },
};
