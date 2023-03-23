import { ApplyOptions } from "@sapphire/decorators";
import { Listener } from "@sapphire/framework";
import { Interaction, Events, GuildMember, TextChannel } from "discord.js";
import { client } from "../..";
import { db } from "../../database/db";
import { BUTTON_IDS } from "../../lib/constants";
import { CONFIG } from "../../lib/setup";

@ApplyOptions<Listener.Options>({ event: Events.InteractionCreate, name: 'Join Interview Thread' })
export class JoinThreadEvent extends Listener {
	public async run(interaction: Interaction) {
        if (!interaction.isButton() || interaction.member?.user.bot || interaction.customId !== BUTTON_IDS.JOIN_THREAD) return;

        try {

            const settings = {
				interviewChannel: CONFIG.interviews.channel,
			};
            
			const data = await db.selectFrom('interview').select(['interview.thread_id']).where('application_id', '=', interaction.message.id).executeTakeFirst();

			if (!data) return interaction.reply({ content: 'Could not find interview in database', ephemeral: true });

			const applicant = await interaction.guild?.members.fetch(data.thread_id);

			if (!applicant) return interaction.reply({ content: 'Could not find applicant in guild', ephemeral: true });

            const channel = (await applicant.guild.channels.fetch(settings.interviewChannel)) as TextChannel;

            if (!channel) return interaction.reply({ content: 'Could not find channel in guild', ephemeral: true });

            await channel.guild.channels.fetch()
            await channel.guild.members.fetch()

            const thread = await channel.threads.fetch(data.thread_id);

            if (!thread) return interaction.reply({ content: 'Could not find thread in guild', ephemeral: true });

            const admin = channel.guild.members.cache.get(interaction.user.id)

			if (!admin) return interaction.reply({ content: 'Could not find admin', ephemeral: true });

            return await thread.members.add(admin)

		} catch (error) {
			client.logger.error(error);
			return interaction.reply({ content: 'Something went wrong', ephemeral: true });
		}
    }
}