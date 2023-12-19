import { ApplyOptions, RequiresGuildContext } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { send } from '@sapphire/plugin-editable-commands';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, Message, TextChannel } from 'discord.js';
import { BUTTON_IDS } from '../lib/constants';
import { CONFIG } from '../lib/setup';
import { logger } from '../lib/logger';

@ApplyOptions<Command.Options>({
	description: 'Send application embed to specified member join channel',
	requiredUserPermissions: 'Administrator'
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		// Register slash command
		registry.registerChatInputCommand((builder) =>
			builder.setName('greet').setDescription('Send application embed to specified member join channel')
		);
	}
	@RequiresGuildContext((message: Message) => send(message, 'This command can only be used in servers'))
	public async messageRun(message: Message) {
		const channel = await message.guild?.channels.fetch(CONFIG.join_channel).catch(async (err) => {
			logger.error(err);
			return await message.reply('Error fetching join channel');
		});

		if (!channel) return;

		const joinChannel = channel as TextChannel;

		const button = new ButtonBuilder().setCustomId(BUTTON_IDS.APPLY).setStyle(1).setLabel('Apply').setEmoji('📜');

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents([button]);

		const embed = new EmbedBuilder().setColor('Blue').setTitle('Beep Boop').setDescription(CONFIG.join_message).setTimestamp();

		await joinChannel.send({ embeds: [embed], components: [row] }).catch(async (err) => {
			logger.error(err);
			await message.reply('Error sending join message');
			return;
		});
	}
}
