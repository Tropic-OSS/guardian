import fastify from 'fastify';
import { logger } from '../lib/logger';

const api = fastify({});

//Middleware
api.register(require('@fastify/websocket'), {
	options: { maxPayload: 1048576 }
});

// Declare a route
api.get('/', async (request, reply) => {
	return { hello: 'world' };
});

export async function startApiServer(port: number) {
	try {
		await api.listen({ port: port });
	} catch (err) {
		logger.error(err);
		process.exit(1);
	}
}
