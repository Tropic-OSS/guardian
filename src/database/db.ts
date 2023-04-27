// import { Kysely, MysqlDialect } from 'kysely';
// import type { DB } from './schema';
// import { createPool } from 'mysql2';
// import { CONFIG } from '../lib/setup';

// export const db = new Kysely<DB>({
// 	dialect: new MysqlDialect({
// 		pool: async () =>
// 			createPool({
// 				host: CONFIG.database.host,
// 				port: CONFIG.database.port,
// 				user: CONFIG.database.user,
// 				password: CONFIG.database.password,
// 				database: CONFIG.database.name
// 			})
// 	})
// });

import { PrismaClient } from '@prisma/client';
import Keyv from 'keyv';

export const timeoutCache = new Keyv();

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
	});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
