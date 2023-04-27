import { Kysely, MysqlDialect } from 'kysely';
import type { DB } from './schema';
import { createPool } from 'mysql2';
import { CONFIG } from '../lib/setup';
import Keyv from 'keyv';

export const timeoutCache = new Keyv();

export const db = new Kysely<DB>({
	dialect: new MysqlDialect({
		pool: async () =>
			createPool({
				host: CONFIG.database.host,
				port: CONFIG.database.port,
				user: CONFIG.database.user,
				password: CONFIG.database.password,
				database: CONFIG.database.name
			})
	})
});
