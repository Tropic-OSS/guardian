import winston from 'winston';
import { transports } from 'winston';

export const logger = winston.createLogger({
	transports: [
		new winston.transports.File({
			filename: 'logs/error.log',
			level: 'error',
			format: winston.format.json()
		}),
		new winston.transports.File({
			filename: 'logs/combined.log',
			format: winston.format.json()
		}),
		new transports.Console({
			level: 'warn',
			format: winston.format.json()
		}),
		new transports.Console({
			level: 'info',
			format: winston.format.combine(winston.format.colorize(), winston.format.simple())
		})
	]
});
