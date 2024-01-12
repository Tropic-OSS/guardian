import {
  ChatInputCommandInteraction,
  Guild,
  GuildMember,
  SlashCommandBuilder,
  TextChannel,
} from "discord.js";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("enroll")
    .setDescription("Sends the apply embed to the welcome channel."),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild)
      return interaction.reply("This command can only be used in a server.");

    if (!interaction.member) return interaction.reply("Member not found.");

    if (!interaction.memberPermissions?.has("Administrator"))
      return interaction.reply(
        "You do not have permission to use this command.",
      );

    const channel = await interaction.guild.channels.fetch(
      interaction.client.config.join_channel,
    );

    if (!channel) return interaction.reply("Join channel not found.");

    if (channel instanceof TextChannel) {
      await channel.send({ embeds: [interaction.client.embeds.apply] });

      await interaction.reply("Apply embed sent.");
    } else {
      await interaction.reply("Join channel specified is not a text channel.");
    }
  },
};
