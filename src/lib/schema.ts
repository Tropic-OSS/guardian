// @ts-check
import { z } from 'zod';

export const configSchema = z.object({
	prefix: z.string().default('!'),
	console_channel: z.string(),
	bot_token: z.string(),
	api_port: z.number(),
	guild_id: z.string(),
	client_id: z.string(),
	status: z.string().optional(),
	join_channel: z.string(),
	join_message: z.string(),
	accept_channel: z.string(),
	accept_message: z.string(),
	member_role: z.string(),
	admin_role: z.string(),
	owners: z.string().array(),
	applications: z.object({
		timeout: z.number(),
		channel: z.string(),
		questions: z.array(z.string())
	}),
	interviews: z.object({
		notification: z.string(),
		role: z.string(),
		channel: z.string(),
		private: z.boolean()
	}),
	whitelist_manager: z.object({
		enabled: z.boolean(),
		inactivity: z.object({
			message: z.string(),
			vacation_role: z.string(),
			remove_inactive_player_after_days: z.number(),
			grace_period_days: z.number(),
			timezone: z.string(),
			cron: z.string()
		})
	}),
	database: z.object({
		host: z.string(),
		port: z.number(),
		user: z.string(),
		password: z.string(),
		name: z.string()
	})
});
