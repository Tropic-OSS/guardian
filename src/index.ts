import './lib/setup';
import { LogLevel, SapphireClient } from '@sapphire/framework';
import { GatewayIntentBits, Partials } from 'discord.js';
import { purge } from './lib/purge';
import { CONFIG } from './lib/setup';
import { logger } from './lib/logger';
var cron = require('node-cron');

export const client = new SapphireClient({
	defaultPrefix: '!',
	regexPrefix: /^(hey +)?bot[,! ]/i,
	caseInsensitiveCommands: true,
	logger: {
		level: process.env.NODE_ENV === 'development' ? LogLevel.Debug : LogLevel.Info
	},
	shards: 'auto',
	intents: [
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.GuildModeration,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.Guilds,
		GatewayIntentBits.MessageContent
	],
	partials: [Partials.Channel, Partials.GuildMember, Partials.Message],
	loadMessageCommandListeners: true
});

const main = async () => {
	try {
		logger.info('Guardian is starting up...');
		await client.login(CONFIG.bot_token).then(() => logger.info('Guardian Is Alive!'));
	} catch (error) {
		logger.error(error);
		client.destroy();
		process.exit(1);
	}

	cron.schedule(
		CONFIG.whitelist_manager.inactivity.cron,
		() => {
			purge();
			logger.info(`Running a job at ${new Date()}`);
		},
		{
			scheduled: CONFIG.whitelist_manager.enabled,
			timezone: CONFIG.whitelist_manager.inactivity.timezone
		}
	);
};

main();
// startApiServer(CONFIG.api_port);
