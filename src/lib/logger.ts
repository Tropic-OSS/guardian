import winston from "winston";
import { transports } from "winston";
import "winston-daily-rotate-file";

export const logger = winston.createLogger({
  transports: [
    new winston.transports.DailyRotateFile({
      filename: "logs/%DATE%.log",
      datePattern: "YYYY-MM-DD-HH",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "5d",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
    new transports.Console({
      level: "info",
      format: winston.format.combine(winston.format.simple()),
    }),
  ],
});
