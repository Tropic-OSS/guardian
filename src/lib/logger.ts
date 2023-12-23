import winston from 'winston';

export const logger = winston.createLogger({
	transports: [
		new winston.transports.File({
			filename: 'logs/error.log',
			level: 'error',
			format: winston.format.combine(winston.format.simple())
		}),
		new winston.transports.File({
			filename: 'logs/combined.log',
			format: winston.format.combine(winston.format.simple())
		}),
	]
});
