# Logger

Backend-only logger for Node.js packages based on Winston logger.

## Configuration

Logger configuration is essentially:

```ts
interface LogConfiguration {
  type: 'hidden' | 'json' | 'pretty'; // Specifies the log format.
  styling: 'on' | 'off'; // Toggles output colorization.
  minLevel: 'debug' | 'info' | 'warn' | 'error'; // Specifies the minimum log level that is logged.
}
```

<!-- NOTE: When editting, be sure to change data-pusher/README.md -->

### `type`

- `hidden` - Silences all logs. This is suitable for test environment.
- `json` - Specifies JSON log format. This is suitable when running in production and streaming logs to other services.
- `pretty` - Logs are formatted in a human-friendly "pretty" way. Ideal, when running the service locally and in
  development.

### `styling`

- `on` - Enables colors in the log output. The output has special color setting characters that are parseable by CLI.
  Recommended when running locally and in development.
- `off` - Disables colors in the log output. Recommended for production.

### `minLevel`

One of the following options:

```ts
'debug' | 'info' | 'warn' | 'error';
```

Logs with smaller level (severity) will be silenced.
