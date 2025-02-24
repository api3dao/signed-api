# signed-api

> A service for storing and accessing signed data. It provides endpoints to handle signed data for a specific airnode.

Signed API is a Node.js API server, dockerized and deployable on any cloud provider or hostable on premise. It stores
the data in memory and provides endpoints to push and retrieve beacon data.

## Configuration

See [configuration](./config/configuration.md) for details.

## Local development

1. `cp config/signed-api.example.json config/signed-api.json` - To create a config file from the example one. Optionally
   change the defaults.
2. `cp .env.example .env` - To copy the example environment variables. Optionally change the defaults.
3. `pnpm run dev` - To start the API server. The port number can be configured by `SERVER_PORT` environment variable.

### Docker instructions

You can use shorthands from package.json. To understand how the docker image is built, read the
[Dockerfile](../../Dockerfile).

```sh
pnpm run docker:build
pnpm run docker:run
```

### Testing

To run the tests:

```sh
pnpm run test
# or to run test only from a specific files (path substring search)
pnpm run test schema
# or to enable logger (by default the logger is disabled by jest.setup.js).
LOGGER_ENABLED=true pnpm run test
```

## API

The API provides the following endpoints:

- `POST /{airnode}`: Insert a batch of signed data.
  - The batch is validated for consistency and data integrity errors. If there is any issue during this step, the whole
    batch is rejected. Otherwise the batch is accepted. Also, all data that is no longer needed is removed during this
    step.
- `GET /{endpoint-name}/{airnode}`: Retrieve signed data for the Airnode respecting the endpoint configuration.
  - Returns the freshest signed data available for the given Airnode, respecting the configured endpoint delay.
- `GET /airnodes`: Retrieve list of all available Airnode address.
  - Returns all Airnode addresses for which there is signed data. It is possible that this data cannot be shown by the
    delayed endpoints (in case the data is too fresh and there is not an older alternative).
- `GET /`: Retrieve system status information.
  - Returns current system configuration details including deployment stage, version, current timestamp, deployment
    timestamp, configuration hash, and certified Airnode addresses.

## Deployment

To deploy signed API on AWS you can use a CloudFormation template in the `deployment` folder. You need to specify the
docker image of the signed API and the URL of the signed API configuration which will be download when the service is
started.

The template will create all necessary AWS resources and assign a domain name to access the the API. You can get the URL
from the output parameters of the CloudFormation stack or by checking the DNS record of the load balancer.

To deploy on premise you can use the Docker instructions below.

## Docker

The API is also dockerized. To run the dockerized APi, you need to:

1. Publish the port of the API to the host machine. The port number of signed API in the container is set to `80`. So
   the command should look like `--publish <HOST_PORT>:80`.
2. Mount config folder to `/app/config`. The folder should contain the `signed-api.json` file.
3. Pass the `-it --init` flags to the docker run command. This is needed to ensure the docker is stopped gracefully. See
   [this](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#handling-kernel-signals) for details.
4. Specify the `--env-file` with the path to the `.env` file containing the [ENV configuration](#environment-variables).
5. Optionally, pass the `--rm` flag to remove the container after it is stopped.

For example:

```sh
# Assuming the current folder contains the "config" folder and ".env" file and the intended host port is 8090.
docker run --publish 8090:80 -it --init --volume $(pwd)/config:/app/config --env-file .env --rm api3/signed-api:latest
```

As of now, the docker image is not published anywhere. You need to build it locally. To build the image run:

```sh
docker build --target signed-api --tag api3/signed-api:latest ../../
```

### Examples

Here are some examples of how to use the API with `curl`. Note, the port may differ based on the configuration.

```sh
# Upsert batch of signed data (HTTP POST)
curl --location 'http://localhost:8090/0xc52EeA00154B4fF1EbbF8Ba39FDe37F1AC3B9Fd4' \
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
curl --location 'http://localhost:8090/airnodes' \
--header 'Content-Type: application/json'

# Get system status (HTTP GET)
curl --location 'http://localhost:8090/' \
--header 'Content-Type: application/json'
```
