import { Command } from '@sapphire/framework';
import { send } from '@sapphire/plugin-editable-commands';
import { Message } from 'discord.js';
import { ApplyOptions, RequiresGuildContext } from '@sapphire/decorators';
import { prisma } from '../server/db';
import { io } from '../server/socket';
import { logger } from '../lib/logger';
import { z } from 'zod';


@ApplyOptions<Command.Options>({
	description: 'Accept Member',
	requiredUserPermissions: 'Administrator'
})
export class UserCommand extends Command {
	// Register slash and context menu command
	public override registerApplicationCommands(registry: Command.Registry) {
		// Register slash command
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('whitlist')
				.setDescription('Creates Whitelist')
		);
	}

	@RequiresGuildContext((message: Message) => send(message, 'This command can only be used in servers'))
	public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const data = await prisma.member.findMany()


        for (const member of data) {
        const mojangProfile = await  getMojangProfile(member.mojang_id)

        if (mojangProfile)
            io.emit('add', { id: addDashes(mojangProfile.id), name: mojangProfile.name })
        }

        return interaction.reply({ content: `There are ${data.length} members in the database`, ephemeral: true });
	}
}

async function getMojangProfile(username: string) {
	try {
		const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);

		if (response.status === 204 || response.status === 404) {
			return null;
		}

		const MojangProfileSchema = z.object({
			id: z.string(),
			name: z.string()
		});

		const data = MojangProfileSchema.parseAsync(await response.json());

		return data;
	} catch (error) {
		logger.error(error);
		return null;
	}
}

function addDashes(id: string) {
	const regex = /([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]+)/g;
	const subst = '$1-$2-$3-$4-$5';
	const newId = id.replace(regex, subst);
	return newId;
}


