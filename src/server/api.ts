import fastify from 'fastify';

// Instantiate Fastify with some config
const api = fastify({
	logger: {
		level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
		formatters: {
			level: (label) => {
				return { level: label };
			},
			log: (obj) => {
				return { ...obj };
			}
		}
	}
});

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
		api.log.error(err);
		process.exit(1);
	}
}
