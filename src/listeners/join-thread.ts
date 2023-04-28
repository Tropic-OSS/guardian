import { ApplyOptions } from "@sapphire/decorators";
import { Listener } from "@sapphire/framework";
import { Interaction, Events, TextChannel, ThreadChannel, GuildMember } from "discord.js";
import { BUTTON_IDS } from "../lib/constants";
import { CONFIG } from "../lib/setup";
import { prisma } from "../server/db";
import { logger } from "../lib/logger";

@ApplyOptions<Listener.Options>({ event: Events.InteractionCreate, name: 'Join Interview Thread' })
export class JoinThreadEvent extends Listener {
	public async run(interaction: Interaction) {
        if (!interaction.isButton() || interaction.member!.user.bot || interaction.customId !== BUTTON_IDS.JOIN_THREAD) return;

        try {
            const settings = {
				interviewChannel: CONFIG.interviews.channel,
			};

            const data = await prisma.application.findUnique({
                where :{
                    application_id: interaction.message.id
                }
            })

			if (!data || ! data.interview_thread_id) return interaction.reply({ content: 'Could not find interview in database', ephemeral: true });

            const channel = (await interaction.guild?.channels.fetch(settings.interviewChannel)) as TextChannel;

            if (!channel) return interaction.reply({ content: 'Could not find channel in guild', ephemeral: true });

            const thread = await channel.threads.fetch(data.interview_thread_id);

            if (!thread) return interaction.reply({ content: 'Could not find thread in guild', ephemeral: true });

            const threadChannel = thread as ThreadChannel;

            const admin = interaction.member as GuildMember

			if (!admin) return interaction.reply({ content: 'Could not find admin', ephemeral: true });

             await threadChannel.members.add(admin).catch((error) => {
                logger.error(error);
                return interaction.reply({ content: 'Something went wrong while adding member', ephemeral: true });
            })

            return await interaction.reply({
                content: `You have been added to the thread: <#${thread.id}>`
            })

		} catch (error) {
			logger.error(error);
			return interaction.reply({ content: 'Something went wrong', ephemeral: true });
		}
    }


}