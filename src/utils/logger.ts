import { createLogger, format, transports } from 'winston';

const { combine, timestamp, printf, colorize, errors } = format;

const consoleFormat = combine(
  colorize(), 
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }), 
  printf(({ level, message, timestamp, stack }) => {
    // If there's an error stack trace, print that. Otherwise, print the message.
    return `[${timestamp}] ${level}: ${stack || message}`;
  })
);

export const logger = createLogger({
  level: 'info', // Default minimum logging level (ignores 'debug' by default)
  transports: [
    new transports.Console({
      format: consoleFormat,
    }),
    
    // save generic stuff to a generic log file
    new transports.File({ 
      filename: 'logs/bot.log',
      format: combine(timestamp(), format.json())
    }),

    // save errors to a specific error file
    new transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      format: combine(timestamp(), format.json())
    }),
  ],
});