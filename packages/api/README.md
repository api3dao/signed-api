# api

> A service for storing and accessing signed data. It provides endpoints to handle signed data for a specific airnode.

Signed API is a Node.js API server, dockerized and deployable on any cloud provider or hostable on premise. It stores
the data in memory and provides endpoints to push and retrieve beacon data.

## Local development

1. `cp config/signed-api.example.json config/signed-api.json` - To create a config file from the example one. Optionally
   change the defaults.
2. `cp .env.example .env` - To copy the example environment variables. Optionally change the defaults.
3. `pnpm run dev` - To start the API server. The port number can be configured in the configuration file.

### Testing

To run the tests:

```sh
pnpm run test
# or to run test only from a specific files (path substring search)
pnpm run test schema
# or to enable logger (by default the logger is disabled by jest.setup.js).
LOGGER_ENABLED=true pnpm run test
```

## Configuration

The API is configured via combination of [environment variables](#environment-variables) and
[configuration file](#configuration-file).

### Environment variables

Parts of the API needs to be initialized prior the configuration files are loaded. This is done via environment
variables. For example:

```sh
# Defines a logger suitable for production.
LOGGER_ENABLED=true
LOG_COLORIZE=false
LOG_FORMAT=json
LOG_LEVEL=info

# Defines the source of the configuration file on AWS S3 (the values specified here are only exemplatory).
CONFIG_SOURCE=aws-s3
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-west-1
AWS_S3_BUCKET_NAME=my-config-bucket
AWS_S3_BUCKET_PATH=configs/my-app/signed-api.json
```

<!-- NOTE: Keep the logger configuration in-sync with pusher. -->

#### `LOGGER_ENABLED`

Enables or disables logging. Options:

- `true` - Enables logging.
- `false` - Disables logging.

#### `LOG_FORMAT`

The format of the log output. Options:

- `json` - Specifies JSON log format. This is suitable when running in production and streaming logs to other services.
- `pretty` - Logs are formatted in a human-friendly "pretty" way. Ideal, when running the service locally and in
  development.

#### `LOG_COLORIZE`

Enables or disables colors in the log output. Options:

- `true` - Enables colors in the log output. The output has special color setting characters that are parseable by CLI.
  Recommended when running locally and in development.
- `false` - Disables colors in the log output. Recommended for production.

#### `LOG_LEVEL`

Defines the minimum level of logs. Logs with smaller level (severity) will be silenced. Options:

- `debug` - Enables all logs.
- `info` - Enables logs with level `info`, `warn` and `error`.
- `warn` - Enables logs with level `warn` and `error`.
- `error` - Enables logs with level `error`.

### Configuration file

The API is configured via `signed-api.json` configuration file.

#### `endpoints`

The API needs to be configured with endpoints to be served. This is done via the `endpoints` section. For example:

```jsonc
// Defines two endpoints.
"endpoints": [
  // Serves the non-delayed data on URL path "/real-time".
  {
    "urlPath": "/real-time",
    "delaySeconds": 0
  },
  // Serves the data delayed by 15 seconds on URL path "/delayed".
  {
    "urlPath": "/delayed",
    "delaySeconds": 15
  }
]
```

##### `endpoints[n]`

Configuration for one of the endpoints.

###### `urlPath`

The URL path on which the endpoint is served. Must start with a slash and contain only alphanumeric characters and
dashes.

###### `delaySeconds`

The delay in seconds for the endpoint. The endpoint will only serve data that is older than the delay.

#### `maxBatchSize`

The maximum number of signed data entries that can be inserted in one batch. This is a safety measure to prevent
spamming theAPI with large payloads. The batch is rejected if it contains more entries than this value.

#### `port`

The port on which the API is served.

#### `cache.maxAgeSeconds`

The maximum age of the cache header in seconds.

#### `allowedAirnodes`

The list of allowed Airnode addresses. If the list is empty, no Airnode is allowed. To whitelist all Airnodes, set the
value to `"all"` instead of an array.

Example:

```jsonc
// Allows pushing signed data from any Airnode.
"allowedAirnodes": "all"
```

or

```jsonc
// Allows pushing signed data only from the specific Airnode.
"allowedAirnodes": ["0xB47E3D8734780430ee6EfeF3c5407090601Dcd15"]
```

## API

The API provides the following endpoints:

- `POST /`: Insert a batch of signed data.
  - The batch is validated for consistency and data integrity errors. If there is any issue during this step, the whole
    batch is rejected. Otherwise the batch is accepted. Also, all data that is no longer needed is removed during this
    step.
- `GET /{endpoint-name}/{airnode}`: Retrieve signed data for the Airnode respecting the endpoint configuration.
  - Only returns the freshest signed data available for the given Airnode, respecting the configured endpoint delay.
- `GET /`: Retrieve list of all available Airnode address.
  - Returns all Airnode addresses for which there is signed data. It is possible that this data cannot be shown by the
    delayed endpoints (in case the data is too fresh and there is not an older alternative).

## Deployment

TODO: Write example how to deploy on AWS.

To deploy on premise you can use the Docker instructions below.

## Docker

The API is also dockerized. To run the dockerized APi, you need to:

1. Publish the port of the API to the host machine using the `--publish` flag.
2. Mount config folder to `/app/config`. The folder should contain the `signed-api.json` file.
3. Pass the `-it --init` flags to the docker run command. This is needed to ensure the docker is stopped gracefully. See
   [this](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#handling-kernel-signals) for details.
4. Specify the `--env-file` with the path to the `.env` file containing the [ENV configuration](#environment-variables).
5. Optionally, pass the `--rm` flag to remove the container after it is stopped.

For example:

```sh
# Assuming the current folder contains the "config" folder and ".env" file and the API port is 8090.
docker run --publish 8090:8090 -it --init --volume $(pwd)/config:/app/config --env-file .env --rm api3/signed-api:latest
```

As of now, the docker image is not published anywhere. You need to build it locally. To build the image run:

```sh
docker build --target api --tag api3/signed-api:latest ../../
```

### Development only docker instructions

You can use shorthands from package.json. To understand how the docker image is built, read the
[Dockerfile](../../Dockerfile).

```sh
pnpm run docker:build
pnpm run docker:run
```

### Examples

Here are some examples of how to use the API with `curl`. Note, the port may differ based on the configuration.

```sh
# Upsert batch of signed data (HTTP POST)
curl --location 'http://localhost:8090' \
--header 'Content-Type: application/json' \
--data '[{
    "beaconId": "0x1896e5d90edcd73e8abc3f5685cb8def4dfc1c7fef8032c4d02095a8ac5d1dba",
    "airnode": "0xc52EeA00154B4fF1EbbF8Ba39FDe37F1AC3B9Fd4",
    "templateId": "0x672fef5bbcf3bfb4c23fdf5dde28c634454e116ff9af4fb12ccf45e06c77aa75",
    "timestamp": "1694644051",
    "encodedValue": "0x00000000000000000000000000000000000000000000005718e3a22ce01f7a40",
    "signature": "0x660b8462edf5d2adf74b4dfe3a5f5ac017cf2fa3f933a78df59a446b341f858f53f4d2487fe45763c6180dadad221daeef01efc4b49038778f5865dbcf79cd0f1c"
  },
  { "airnode": "0xc52EeA00154B4fF1EbbF8Ba39FDe37F1AC3B9Fd4",
    "beaconId": "0x1e63023d28b5252da94ac707582b2b95b0e9d18fbf6ebe0cfd009967c6bf58fc",
    "templateId": "0xc938ba9dd0be0637d17830676a1e3f1292032f8e7990eac20a25c3c2a07a99dd",
    "timestamp": "1694644051",
    "encodedValue": "0x00000000000000000000000000000000000000000000000012988bbd65ac6be8",
    "signature": "0x68b460e96122a3f8addecbf5e1713169b7befe5b0b39a5b0bfdea827ca39266b2887c8a4c0c20ffd38ff9e8344766e72c3c5ed11a720b4809536ac4722ee85511c"
  }]'

# Get data for the airnode address (HTTP GET)
curl --location 'http://localhost:8090/real-time/0xc52EeA00154B4fF1EbbF8Ba39FDe37F1AC3B9Fd4' \
--header 'Content-Type: application/json'

# List available airnode addresses (HTTP GET)
curl --location 'http://localhost:8090' \
--header 'Content-Type: application/json'
```
