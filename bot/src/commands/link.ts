import { ApplyOptions, RequiresGuildContext } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { send } from '@sapphire/plugin-editable-commands';
import { EmbedBuilder, Message, TextChannel } from 'discord.js';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { CONFIG } from '../lib/setup';
import { prisma } from '../server/db';
import { io } from '../server/socket';

@ApplyOptions<Command.Options>({
    description: 'Links A Member To Their Account',
    requiredUserPermissions: 'Administrator'
})
export class UserCommand extends Command {
    // Register slash and context menu command
    public override registerApplicationCommands(registry: Command.Registry) {
        // Register slash command
        registry
            .registerChatInputCommand((builder) =>
                builder
                    .setName('link')
                    .setDescription('Links A Member To Their Account')
                    .addStringOption((option) => option.setName('username').setDescription('Minecraft username for the user').setRequired(true))
                    .addUserOption((option) => option.setName('discord').setDescription('Discord Account for the user').setRequired(true))
            );
    }

    @RequiresGuildContext((message: Message) => send(message, 'This command can only be used in servers'))
    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        if (interaction.member!.user.bot) return interaction.reply('Bots cannot link members');

        const { value: username } = interaction.options.get('username', true);

        const { value: discord } = interaction.options.get('discord', true);

        const [member, mojangUser] = await Promise.all([
            interaction.guild!.members.fetch(discord as string),
            getMojangProfile(username as string)
        ]);

        if (!member || !mojangUser) {
            return await interaction.reply({ content: 'Member or Mojang User could not be found', ephemeral: true });
        }

        const memberRole = await interaction.guild!.roles.fetch(CONFIG.member_role)

        const acceptChannel = await interaction.guild!.channels.fetch(CONFIG.accept_channel) as TextChannel;

        if (!memberRole || !acceptChannel)
            return await interaction
                .reply({
                    content:
                        'Something went wrong trying to fetch roles and channels, check if your config file values are corrct, if the problem persists go to your error logs and file a report on github',
                    ephemeral: true
                })
                .catch(async (err) => {
                    logger.error(err);
                });

        prisma.member.upsert({
            where: {
                mojang_id: addDashes(mojangUser.id)
            },
            update: {
                mojang_id: addDashes(mojangUser.id),
                discord_id: member.id,
                grace_period: new Date(Date.now() + 1000 * 60 * 60 * 24 * CONFIG.whitelist_manager.inactivity.grace_period_days),
            },
            create: {
                mojang_id: addDashes(mojangUser.id),
                discord_id: member.id,
                grace_period: new Date(Date.now() + 1000 * 60 * 60 * 24 * CONFIG.whitelist_manager.inactivity.grace_period_days)
            }
        }).catch(async (err) => {
            logger.error(err);
            return await interaction.reply({
                content:
                    'Something went wrong trying to add member to the database, if the problem persists go to your error logs and file a report on github',
                ephemeral: true
            });
        });

        await member.roles.add(memberRole).catch(async (err) => {
            logger.error(err);
            return await interaction.reply({
                content:
                    'Something went wrong trying to add role to user,check if they already have the role,if the problem persists go to your error logs and file a report on github',
                ephemeral: true
            });
        })

        await member.setNickname(member.displayName + `(${mojangUser.name})`);

        const event = {
            id: addDashes(mojangUser.id),
            name: mojangUser.name
        };

        io.emit('add', event);

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`Link Created`)
            .setAuthor({
                name: 'Guardian',
                iconURL: 'https://cdn.discordapp.com/avatars/1063626648399921170/60021a9282221d831512631d8e82b33d.png'
            })
            .addFields({ name: 'Discord Name', value: `${member}`, inline: true }, { name: 'IGN', value: `${mojangUser.name}`, inline: true })
            .setImage(`https://crafatar.com/renders/body/${mojangUser.id}?scale=3`)
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
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

