import { ApplyOptions, RequiresGuildContext } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { send } from '@sapphire/plugin-editable-commands';
import { Message } from 'discord.js';
import { purge } from '../lib/purge';

@ApplyOptions<Command.Options>({
	description: 'Purge Members',
	requiredUserPermissions: 'Administrator'
})
export class UserCommand extends Command {
	// Register slash and context menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Register slash command
		registry.registerChatInputCommand((builder) => builder.setName('purge').setDescription('Purge Members'));
	}

	@RequiresGuildContext((message: Message) => send(message, 'This command can only be used in servers'))
	public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
		if (interaction.member!.user.bot) return interaction.reply('Bots cannot purge members');

		await interaction.reply({
			content: 'Executing order 66',
			ephemeral: true
		});

		return purge();
	}
}
