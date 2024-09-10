# Configuration

The API is configured via combination of [environment variables](#environment-variables) and
[configuration files](#configuration-files).

## Environment variables

Parts of the API needs to be initialized prior the configuration files are loaded. This is done via environment
variables. All of the environment variables are optional and or set with default values for convenience.

Example:

```sh
# Defines a logger suitable for production.
LOGGER_ENABLED=true
LOG_API_DATA=false
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

<!-- NOTE: Keep the logger configuration in-sync with Airnode feed package. -->

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

### `LOG_API_DATA` _(optional)_

Enables or disables logging of the API data at the `info` level. When set to `true`, received valid signed data will be
logged with the fields `airnode`, `encodedValue`, `templateId`, `timestamp` and `signature`. The logging of this data is
delayed to make sure people with access to the logs won't be able to misuse the beacon data. Options:

- `true` - Enables logging of the API data.
- `false` - Disables logging of the API data.

Default: `false`.

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

### `CONFIG_SOURCE` _(optional)_

Defines the source of the configuration file. Options:

- `aws-s3` - The configuration file is downloaded from AWS S3.
- `local` - The configuration file is loaded from the local file system.

Default: `local`.

### `AWS_ACCESS_KEY_ID` _(optional)_

The AWS access key ID. Required when `CONFIG_SOURCE` is set to `aws-s3`.

### `AWS_SECRET_ACCESS_KEY` _(optional)_

The AWS secret access key. Required when `CONFIG_SOURCE` is set to `aws-s3`.

### `AWS_REGION` _(optional)_

The AWS region. Required when `CONFIG_SOURCE` is set to `aws-s3`.

### `AWS_S3_BUCKET_NAME` _(optional)_

The name of the AWS S3 bucket. Required when `CONFIG_SOURCE` is set to `aws-s3`.

### `AWS_S3_BUCKET_PATH` _(optional)_

The path to the configuration file in the AWS S3 bucket. Required when `CONFIG_SOURCE` is set to `aws-s3`.

## Configuration files

The API is configured via combination of `signed-api.json` and `secrets.env` configuration files. All expressions of a
form `${SECRET_NAME}` are referring to values from secrets and are interpolated inside the `signed-api.json` at runtime.
You are advised to put sensitive information inside secrets file.

### `endpoints`

The API needs to be configured with endpoints to be served. This is done via the `endpoints` section. For example:

```jsonc
// Defines three endpoints.
"endpoints": [
  // Serves the non-delayed data on URL path "/real-time". Requesters need to provide the "some-secret-token" as Bearer token. The endpoint exposes the beacon data for base feeds.
  {
    "urlPath": "/real-time",
    "delaySeconds": 0,
    "authTokens": ["some-secret-token"],
    "isOev": false
  },
  // Serves the non-delayed data on URL path "/real-time-oev". Requesters need to provide the "some-secret-token" as Bearer token. This endpoint only exposes the OEV beacon data.
  {
    "urlPath": "/real-time-oev",
    "delaySeconds": 0,
    "authTokens": ["some-secret-token"],
    "isOev": true
  },
  // Serves the data delayed by 15 seconds on URL path "/delayed". No authentication is required.
  {
    "urlPath": "/delayed",
    "delaySeconds": 15,
    "authTokens": null,
    "isOev": false
  },
  // Serve the unsigned data in real-time on URL path "/unsigned-real-time". No authentication is required.
  {
    "urlPath": "/unsigned-real-time",
    "authTokens": null,
    "delaySeconds": 0,
    "hideSignatures": true,
    "isOev": false
  }
]
```

#### `endpoints[n]`

Configuration for one of the endpoints.

##### `urlPath`

The URL path on which the endpoint is served. Must start with a slash and contain only alphanumeric characters and
dashes.

##### `delaySeconds`

The delay in seconds for the endpoint. The endpoint will only serve data that is older than the delay.

##### `authTokens`

The nonempty list of
[Bearer authentication tokens](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication#bearer) allowed to query
the data.

In case the endpoint should be publicly available, set the value to `null`.

##### `hideSignatures` _(optional)_

The boolean flag to hide the signatures in the response. The flag is optional for backwards compatibility with older
Signed API versions.

##### `isOev`

The boolean flag to indicate if the endpoint serves the data for OEV beacons. This data can be used to update the API3
proxies with the latest OEV data, but cannot be used to update the main API3 base feeds.

### `cache` _(optional)_

Configures the cache (specifically caching headers) for the API endpoints using the GET HTTP method.

Defaults to no cache (no headers).

#### `type`

The type of the cache. Options:

- `browser` - Sets the standard `cache-control: max-age=XYZ` header.
- `cdn` - Similar to `browser` cache, but also sets the `cdn-cache-control` to the same value as `cache-control`.
  Setting both headers is necessary to support CDNs which do not support `cdn-cache-control` header.

#### `maxAgeSeconds`

The maximum age of the cache in seconds. The cache is cleared after this time.

### `allowedAirnodes`

The list of allowed Airnodes with authorization details. If the list is empty, no Airnode is allowed. To whitelist all
Airnodes, set the value to `"*"` instead of an array.

Example:

```jsonc
// Allows pushing signed data from any Airnode.
"allowedAirnodes": "*"
```

or

```jsonc
// Allows pushing signed data only for the specific Airnode. No authorization is required to push the data.
"allowedAirnodes": [ { "address": "0xB47E3D8734780430ee6EfeF3c5407090601Dcd15", "authTokens": null } ]
```

or

```jsonc
// Allows pushing signed data only for the specific Airnode. The pusher needs to authorize with one of the specific tokens.
"allowedAirnodes": { "address": "0xbF3137b0a7574563a23a8fC8badC6537F98197CC", "authTokens": ["some-secret-token-for-airnode-feed"] }
```

#### `allowedAirnodes[n]`

One of the allowed Airnodes.

##### `address`

The address of the Airnode. The address must be a valid Ethereum address.

##### `authTokens`

The nonempty list of
[Bearer authentication tokens](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication#bearer).

To allow pushing data without any authorization, set the value to `null`. The API validates the data, but this is not
recommended.

#### `stage`

An identifier of the deployment stage. This is used to distinguish between different deployments of Signed API, for
example `dev`, `staging` or `production`. The stage value can have 256 characters at maximum and can only include
lowercase alphanumeric characters and hyphens.

#### `version`

The version specified in the config must match the version of the Signed API at deployment time.
