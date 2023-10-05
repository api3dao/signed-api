import winston from 'winston';
import { consoleFormat } from 'winston-console-format';
import { z } from 'zod';

export const logFormatSchema = z.union([z.literal('json'), z.literal('pretty')]);

export type LogType = z.infer<typeof logFormatSchema>;

export const logLevelSchema = z.union([z.literal('debug'), z.literal('info'), z.literal('warn'), z.literal('error')]);

export type LogLevel = z.infer<typeof logLevelSchema>;

export const logConfigSchema = z.object({
  colorize: z.boolean(),
  enabled: z.boolean(),
  format: logFormatSchema,
  minLevel: logLevelSchema,
});

export type LogConfig = z.infer<typeof logConfigSchema>;

const createConsoleTransport = (config: LogConfig) => {
  const { colorize, enabled, format } = config;

  if (!enabled) {
    return new winston.transports.Console({ silent: true });
  }

  switch (format) {
    case 'json': {
      return new winston.transports.Console({ format: winston.format.json() });
    }
    case 'pretty': {
      const formats = [
        colorize ? winston.format.colorize({ all: true }) : null,
        winston.format.padLevels(),
        consoleFormat({
          showMeta: true,
          metaStrip: [],
          inspectOptions: {
            depth: Number.POSITIVE_INFINITY,
            colors: colorize,
            maxArrayLength: Number.POSITIVE_INFINITY,
            breakLength: 120,
            compact: Number.POSITIVE_INFINITY,
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
  const { enabled, minLevel } = config;

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
    silent: !enabled,
    exitOnError: false,
    transports: [createConsoleTransport(config)],
  });
};

export type LogContext = Record<string, any>;

export interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: ((message: string, context?: LogContext) => void) &
    ((message: string, error: Error, context?: LogContext) => void);
  child: (options: { name: string }) => Logger;
}

// Winston by default merges content of `context` among the rest of the fields for the JSON format.
// That's causing an override of fields `name` and `message` if they are present.
const wrapper = (logger: Logger): Logger => {
  return {
    debug: (message, context) => logger.debug(message, context ? { context } : undefined),
    info: (message, context) => logger.info(message, context ? { context } : undefined),
    warn: (message, context) => logger.warn(message, context ? { context } : undefined),
    // We need to handle both overloads of the `error` function
    error: (message, errorOrContext, context) => {
      if (errorOrContext instanceof Error) {
        logger.error(message, errorOrContext, context ? { context } : undefined);
      } else {
        logger.error(message, errorOrContext ? { context: errorOrContext } : undefined);
      }
    },
    child: (options) => wrapper(logger.child(options)),
  } as Logger;
};

export const createLogger = (config: LogConfig) => wrapper(createBaseLogger(config));
