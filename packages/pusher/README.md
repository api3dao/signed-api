# pusher

> A service for storing and accessing signed data.

Pusher is a Node.js service, dockerized and deployable on any cloud provider or hostable on premise. It is continuously
running two core loops:

1. `Fetch beacon data` - Each `triggers.signedApiUpdates` entry defines a group of templates. Pusher makes a template
   request to the API specified in the OIS to get the template data. Pusher's wallet is used to sign the responses and
   these are then saved to in-memory storage.
2. `Push signed beacon data to signed API` - For each `triggers.signedApiUpdates`, periodically checks the in-memory
   storage and pushes the signed data to the configured API.

## Local development

The pusher needs a configuration in order to run. The `config` folder contains example configuration which uses:

- [Nodary](https://nodary.io/) as the data provider, from which the data is fetched.
- Signed API running on `http://localhost:8090` where the data is pushed.

To start the the pusher in dev mode run the following:

1. `cp config/pusher.example.json config/pusher.json` - To copy the pusher configuration from the example. Note, the
   `pusher.json` file is ignored by git. If you are using Docker Desktop, you need to change the URL from localhost to
   `host.docker.internal`. For example:

   ```jsonc
   "url": "http://host.docker.internal:8090"
   ```

2. `cp config/secrets.example.env config/secrets.env` - To copy the secrets.env needed for the configuration. This file
   is also ignored by git.
3. Set the `NODARY_API_KEY` inside the secrets file. Ask someone from development team for the key.
4. `cp .env.example .env` - To copy the example environment variables. Optionally change the defaults.
5. `pnpm run dev` - To run the pusher. This step assumes already running signed API as specified in the `pusher.json`
   configuration.

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

Pusher can be configured via a combination of [environment variables](#environment-variables) and
[configuration files](#configuration-files).

### Environment variables

Logging needs to be initialized prior the configuration files are loaded. This is done via environment variables. For
example:

```sh
# Defines a logger suitable for production.
LOGGER_ENABLED=true
LOG_COLORIZE=false
LOG_FORMAT=json
LOG_LEVEL=info
```

or

```sh
# Defines a logger suitable for local development or testing.
LOGGER_ENABLED=true
LOG_COLORIZE=false
LOG_FORMAT=json
LOG_LEVEL=info
```

<!-- NOTE: Keep the logger configuration in-sync with API. -->

#### `LOGGER_ENABLED`

Enables or disables logging. Options:

- `true` - Enables logging.
- `false` - Disables logging.

Default: `true`.

#### `LOG_FORMAT`

The format of the log output. Options:

- `json` - Specifies JSON log format. This is suitable when running in production and streaming logs to other services.
- `pretty` - Logs are formatted in a human-friendly "pretty" way. Ideal, when running the service locally and in
  development.

Default: `json`.

#### `LOG_COLORIZE`

Enables or disables colors in the log output. Options:

- `true` - Enables colors in the log output. The output has special color setting characters that are parseable by CLI.
  Recommended when running locally and in development.
- `false` - Disables colors in the log output. Recommended for production.

Default: `false`.

#### `LOG_LEVEL`

Defines the minimum level of logs. Logs with smaller level (severity) will be silenced. Options:

- `debug` - Enables all logs.
- `info` - Enables logs with level `info`, `warn` and `error`.
- `warn` - Enables logs with level `warn` and `error`.
- `error` - Enables logs with level `error`.

Default: `info`.

### Configuration files

Pusher needs two configuration files, `pusher.json` and `secrets.env`. All expressions of a form `${SECRET_NAME}` are
referring to values from secrets and are interpolated inside the `pusher.json` at runtime. You are advised to put
sensitive information inside secrets.

You can also refer to the [example configuration](./config).

#### `templates`

Configuration for the template requests. Each template request is defined by a `templateId` and a `template` object. For
example:

```jsonc
// Defines a single template.
"templates": {
  "0xcc35bd1800c06c12856a87311dd95bfcbb3add875844021d59a929d79f3c99bd": {
    "endpointId": "0x3528e42b017a5fbf9d2993a2df04efc3ed474357575065a111b054ddf9de2acc",
    "parameters": [{ "type": "string32", "name": "name", "value": "WTI/USD" }]
  }
}
```

The template ID hash is derived from the template object. You can derive the ID using `ethers` library:

```js
ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string', 'string'], [oisTitle, endpointName]));
```

##### `templates[<TEMPLATE_ID>]`

Configuration for the template object with ID `<TEMPLATE_ID>`.

###### `endpointId`

The ID of the endpoint to which the template request is made.

###### `parameters`

The parameters of the template request. Refer to
[Airnode ABI](https://dapi-docs.api3.org/reference/airnode/latest/specifications/airnode-abi.html) specification for
details.

###### `parameters[n]`

Defines one of the parameters of the template request.

`type`

Refer to
[Airnode ABI available types](https://dapi-docs.api3.org/reference/airnode/latest/specifications/airnode-abi.html#details).

`name`

The name of the parameter.

`value`

The value of the parameter.

#### `endpoints`

Configuration for the endpoints. Each endpoint is defined by an `endpointId` and an `endpoint` object. For example:

```jsonc
"endpoints": {
  // Defines a single endpoint pointing to the OIS with title "Nodary" and endpoint named "feed".
  "0x3528e42b017a5fbf9d2993a2df04efc3ed474357575065a111b054ddf9de2acc": {
    "endpointName": "feed",
    "oisTitle": "Nodary"
  }
}
```

The endpoint ID hash is derived from the endpoint object. You can derive the ID using `ethers` library:

```js
ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string', 'string'], [oisTitle, endpointName]));
```

##### `endpoints[<ENDPOINT_ID>]`

Configuration for the endpoint object with ID `<ENDPOINT_ID>`.

###### `endpointName`

The name of the endpoint.

###### `oisTitle`

The title of the OIS to which the endpoint belongs.

#### `triggers.signedApiUpdates`

Configuration for the signed API update triggers. There can be multiple triggers, each specifying a different update
configuration.

For example:

```jsonc
"triggers": {
  // Defines a single trigger.
  "signedApiUpdates": [
    {
      // The data is pushed to the signed API named "localhost".
      "signedApiName": "localhost",
      // The data is fetched for the templates with the template IDs specified below.
      "templateIds": [
        "0xcc35bd1800c06c12856a87311dd95bfcbb3add875844021d59a929d79f3c99bd",
        "0x086130c54864b2129f8ac6d8d7ab819fa8181bbe676e35047b1bca4c31d51c66",
        "0x1d65c1f1e127a41cebd2339f823d0290322c63f3044380cbac105db8e522ebb9"
      ],
      // The template data is fetched every 5 seconds.
      "fetchInterval": 5,
      // The data remains in in-memory storage for at least 30 seconds before it can be pushed to the signed API.
      "updateDelay": 30
    }
  ]
}
```

##### `triggers.signedApiUpdates[n]`

Configuration for one of the signed API update triggers. Pusher periodically pushes the data to the signed API. The
period is `2.5` seconds.

Pusher only makes a single template request independently of the number of template IDs specified. This is to reduce the
number of data provider calls. This implies that all of the templates in the trigger must use the same endpoint and
parameters. You can use [OIS processing](https://dapi-docs.api3.org/reference/ois/latest/processing.html) to remove the
parameters before making the request (using pre-processing) and later get the corresponding template value based on the
endpoint parameters (using-processing). Refer to the [example configuration](./config) for details.

###### `signedApiName`

The name of the signed API to which the data is pushed.

###### `templateIds`

The IDs of the templates for which the data is fetched, signed and pushed.

###### `fetchInterval`

The interval in seconds between two consecutive fetches of the template data.

###### `updateDelay`

The minimum delay in seconds before the data can be pushed to signed API.

#### `signedApis`

Configuration for the signed APIs. Each signed API is defined by a `signedApiName` and a `signedApi` object. For
example:

```jsonc
// Defines a single signed API.
"signedApis": [
  {
    "name": "localhost",
    "url": "http://localhost:8090"
  }
]
```

##### `signedApis[n]`

Configuration for one of the signed APIs.

###### `name`

The name of the signed API.

###### `url`

The URL of the signed API.

#### `ois`

Configuration for the OISes.

<!-- There is no example, because OISes are too large. -->

##### `ois[n]`

Refer to the [OIS documentation](https://dapi-docs.api3.org/reference/ois/latest/).

#### `apiCredentials`

Refer to Airnode's
[API credentials](https://dapi-docs.api3.org/reference/airnode/latest/deployment-files/config-json.html#apicredentials).

#### `nodeSettings`

Contains general deployment parameters of the pusher.

##### `nodeVersion`

The version of the pusher. The version specified in the config must match the version of the pusher at deployment time.

##### `airnodeWalletMnemonic`

Mnemonic for the airnode wallet used to sign the template responses. It is recommended to interpolate this value from
secrets. For example:

```jsonc
// The mnemonic is interpolated from the "WALLET_MNEMONIC" secret.
"airnodeWalletMnemonic": "${WALLET_MNEMONIC}"
```

##### `stage`

An identifier of the deployment stage. This is used to distinguish between different deployments of pusher, for example
`dev`, `staging` or `production`. The stage value can have 256 characters at maximum and can only include lowercase
alphanumeric characters and hyphens.

## Deployment

<!-- markdown-link-check-disable -->

To deploy Pusher on AWS you can use the Cloud Formation template created by the API integrations team. The template can
be found in the private api-integrations repository
[here](https://github.com/api3dao/api-integrations/blob/main/data/cloudformation-template.json).

<!-- markdown-link-check-enable -->

To deploy on premise you can use the Docker instructions below.

## Docker

Pusher is also dockerized. To run the dockerized pusher you need to:

1. Mount config folder to `/app/config`. The folder should contain the `pusher.json` and `secrets.env` files.
2. Pass the `-it --init` flags to the docker run command. This is needed to ensure the docker is stopped gracefully. See
   [this](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#handling-kernel-signals) for details.
3. Specify the `--env-file` with the path to the `.env` file containing the [ENV configuration](#environment-variables).
4. Optionally, pass the `--rm` flag to remove the container after it is stopped.
5. If running on Linux, you need to use the `--network host` to access the host network. This has no effect for Docker
   Desktop.
6. Lastly, if you are using Docker Desktop and you want to access the host machine, you need to change the host URL from
   `localhost` to `host.docker.internal` in the configuration files.

For example:

```sh
# Assuming the current folder contains the "config" folder and ".env" file.
docker run -it --init --volume $(pwd)/config:/app/config --env-file .env --rm api3/pusher:latest
```

As of now, the docker image is not published anywhere. You need to build it locally. To build the image run:

```sh
docker build --target pusher --tag api3/pusher:latest ../../
```

### Development only docker instructions

You can use shorthands from package.json. To understand how the docker image is built, read the
[Dockerfile](../../Dockerfile).

```sh
pnpm run docker:build
pnpm run docker:run
```
