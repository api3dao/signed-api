import winston from 'winston';
import { z } from 'zod';
import { consoleFormat } from 'winston-console-format';

export const logTypeSchema = z.union([z.literal('hidden'), z.literal('json'), z.literal('pretty')]);

export type LogType = z.infer<typeof logTypeSchema>;

export const logStylingSchema = z.union([z.literal('on'), z.literal('off')]);

export type LogStyling = z.infer<typeof logStylingSchema>;

export const logLevelSchema = z.union([z.literal('debug'), z.literal('info'), z.literal('warn'), z.literal('error')]);

export type LogLevel = z.infer<typeof logLevelSchema>;

export const logConfigSchema = z.object({
  type: logTypeSchema,
  styling: logStylingSchema,
  minLevel: logLevelSchema,
});

export type LogConfig = z.infer<typeof logConfigSchema>;

const createConsoleTransport = (config: LogConfig) => {
  const { type, styling } = config;

  switch (type) {
    case 'hidden':
      return new winston.transports.Console({ silent: true });
    case 'json':
      return new winston.transports.Console({ format: winston.format.json() });
    case 'pretty': {
      const formats = [
        styling === 'on' ? winston.format.colorize({ all: true }) : null,
        winston.format.padLevels(),
        consoleFormat({
          showMeta: true,
          metaStrip: [],
          inspectOptions: {
            depth: Infinity,
            colors: styling === 'on',
            maxArrayLength: Infinity,
            breakLength: 120,
            compact: Infinity,
          },
        }),
      ].filter(Boolean) as winston.Logform.Format[];

      return new winston.transports.Console({
        format: winston.format.combine(...formats),
      });
    }
  }
};

const createBaseLogger = (config: LogConfig) => {
  const { type, minLevel } = config;

  return winston.createLogger({
    level: minLevel,
    // This format is recommended by the "winston-console-format" package.
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.ms(),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    silent: type === 'hidden',
    exitOnError: false,
    transports: [createConsoleTransport(config)],
  });
};

export type LogContext = Record<string, any>;

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  error(message: string, error: Error, context?: LogContext): void;
  child(options: { name: string }): Logger;
}

// Winston by default merges content of `context` among the rest of the fields for the JSON format.
// That's causing an override of fields `name` and `message` if they are present.
const wrapper = (logger: Logger): Logger => {
  return {
    debug: (message, context) => logger.debug(message, { context }),
    info: (message, context) => logger.info(message, { context }),
    warn: (message, context) => logger.warn(message, { context }),
    // We need to handle both overloads of the `error` function
    error: (message, errorOrContext, context) => {
      if (errorOrContext instanceof Error) {
        logger.error(message, errorOrContext, { context });
      } else {
        logger.error(message, { context: errorOrContext });
      }
    },
    child: (options) => wrapper(logger.child(options)),
  } as Logger;
};

export const createLogger = (config: LogConfig) => wrapper(createBaseLogger(config));
