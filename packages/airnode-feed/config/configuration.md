# Configuration

Airnode feed can be configured via a combination of [environment variables](#environment-variables) and
[configuration files](#configuration-files).

## Environment variables

Logging needs to be initialized prior the configuration files are loaded. This is done via environment variables. All of
the environment variables are optional and or set with default values for convenience.

Example:

```sh
# Defines a logger suitable for production.
LOGGER_ENABLED=true
LOG_COLORIZE=false
LOG_FORMAT=json
LOG_HEARTBEAT=true
LOG_LEVEL=info
```

or

```sh
# Defines a logger suitable for local development or testing.
LOGGER_ENABLED=true
LOG_COLORIZE=false
LOG_FORMAT=json
LOG_HEARTBEAT=true
LOG_LEVEL=debug
```

<!-- NOTE: Keep the logger configuration in-sync with API. -->

### `LOGGER_ENABLED` _(optional)_

Enables or disables logging. Options:

- `true` - Enables logging.
- `false` - Disables logging.

Default: `true`.

### `LOG_FORMAT` _(optional)_

The format of the log output. Options:

- `json` - Specifies JSON log format. This is suitable when running in production and streaming logs to other services.
- `pretty` - Logs are formatted in a human-friendly "pretty" way. Ideal, when running the service locally and in
  development.

Default: `json`.

### `LOG_HEARTBEAT` _(optional)_

Enables or disables the heartbeat log. The heartbeat log is a cryptographically secure log that is emitted every 60
seconds to indicate that the service is running. The log includes useful information such as the deployment timestamp
and configuration hash. Options:

- `true` - Enables the heartbeat log.
- `false` - Disables the heartbeat log.

Default: `true`.

### `LOG_COLORIZE` _(optional)_

Enables or disables colors in the log output. Options:

- `true` - Enables colors in the log output. The output has special color setting characters that are parseable by CLI.
  Recommended when running locally and in development.
- `false` - Disables colors in the log output. Recommended for production.

Default: `false`.

### `LOG_LEVEL` _(optional)_

Defines the minimum level of logs. Logs with smaller level (severity) will be silenced. Options:

- `debug` - Enables all logs.
- `info` - Enables logs with level `info`, `warn` and `error`.
- `warn` - Enables logs with level `warn` and `error`.
- `error` - Enables logs with level `error`.

Default: `info`.

## Configuration files

Airnode feed needs two configuration files, `airnode-feed.json` and `secrets.env`. All expressions of a form
`${SECRET_NAME}` are referring to values from secrets and are interpolated inside the `airnode-feed.json` at runtime.
You are advised to put sensitive information inside secrets file.

You can also refer to the example configuration files.

### `templates`

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

#### `templates[<TEMPLATE_ID>]`

Configuration for the template object with ID `<TEMPLATE_ID>`.

##### `endpointId`

The ID of the endpoint to which the template request is made.

##### `parameters`

The parameters of the template request. Refer to
[Airnode ABI](https://airnode-docs.api3.org/reference/airnode/latest/specifications/airnode-abi.html) specification for
details.

##### `parameters[n]`

Defines one of the parameters of the template request.

`type`

Refer to
[Airnode ABI available types](https://airnode-docs.api3.org/reference/airnode/latest/specifications/airnode-abi.html#details).

`name`

The name of the parameter.

`value`

The value of the parameter.

### `endpoints`

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

#### `endpoints[<ENDPOINT_ID>]`

Configuration for the endpoint object with ID `<ENDPOINT_ID>`.

##### `endpointName`

The name of the endpoint.

##### `oisTitle`

The title of the OIS to which the endpoint belongs.

### `triggers.signedApiUpdates`

Configuration for the signed API update triggers. There can be multiple triggers, each specifying a different update
configuration.

For example:

```jsonc
"triggers": {
  // Defines a single trigger.
  "signedApiUpdates": [
    {
      // The data is fetched for the templates with the template IDs specified below.
      "templateIds": [
        "0xcc35bd1800c06c12856a87311dd95bfcbb3add875844021d59a929d79f3c99bd",
        "0x086130c54864b2129f8ac6d8d7ab819fa8181bbe676e35047b1bca4c31d51c66",
        "0x1d65c1f1e127a41cebd2339f823d0290322c63f3044380cbac105db8e522ebb9"
      ],
      // The template data is fetched every 5 seconds.
      "fetchInterval": 5,
    }
  ]
}
```

#### `triggers.signedApiUpdates[n]`

Configuration for one of the signed API update triggers. Airnode feed periodically fetches data from data provider and
pushes it to all Signed APIs defined in the configuration file.

Airnode feed only makes a single template request independently of the number of template IDs specified. This is to
reduce the number of data provider calls. This implies that all of the templates in the trigger must use the same
endpoint and parameters. You can use
[OIS processing](https://airnode-docs.api3.org/reference/ois/latest/processing.html) to remove the parameters before
making the request (using pre-processing) and later get the corresponding template value based on the endpoint
parameters (using-processing).

##### `templateIds`

The IDs of the templates for which the data is fetched, signed and pushed.

##### `fetchInterval`

The interval in seconds between two consecutive fetches of the template data.

### `signedApis`

Configuration for the signed APIs. For example:

```jsonc
// Defines a single signed API that uses AUTH_TOKEN secret as Bearer token when pushing signed data to signed API.
"signedApis": [
  {
    "name": "localhost",
    "url": "http://localhost:8090",
    "authToken": "${AUTH_TOKEN}"
  }
]
```

#### `signedApis[n]`

Configuration for one of the signed APIs.

##### `name`

The name of the signed API.

##### `url`

The URL of the signed API.

#### `authToken`

The authentication token used to authenticate with the signed API. It is recommended to interpolate this value from
secrets.

If the signed API does not require authentication, set this value to `null`.

### `ois`

Configuration for the OISes.

<!-- There is no example, because OISes are too large. -->

#### `ois[n]`

Refer to the [OIS documentation](https://airnode-docs.api3.org/reference/ois/latest/).

### `apiCredentials`

Refer to Airnode's
[API credentials](https://airnode-docs.api3.org/reference/airnode/latest/deployment-files/config-json.html#apicredentials).

### `nodeSettings`

Contains general deployment parameters of the Airnode feed.

#### `nodeVersion`

The version of the Airnode feed. The version specified in the config must match the version of the Airnode feed at
deployment time.

#### `airnodeWalletMnemonic`

Mnemonic for the airnode wallet used to sign the template responses. It is recommended to interpolate this value from
secrets. For example:

```jsonc
// The mnemonic is interpolated from the "WALLET_MNEMONIC" secret.
"airnodeWalletMnemonic": "${WALLET_MNEMONIC}"
```

#### `stage`

An identifier of the deployment stage. This is used to distinguish between different deployments of Airnode feed, for
example `dev`, `staging` or `production`. The stage value can have 256 characters at maximum and can only include
lowercase alphanumeric characters and hyphens.
