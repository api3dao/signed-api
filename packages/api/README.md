# api

A service for storing and accessing signed data. It provides endpoints to handle signed data for a specific airnode.

## Local development

1. `cp config/signed-api.example.json config/signed-api.json` - To create a config file from the example one. Optionally
   change the defaults.
2. `pnpm run dev` - To start the API server. The port number can be configured in the configuration file.

## Deployment

TODO: Write example how to deploy on AWS (and maybe other cloud providers as well).

## Usage

The API provides the following endpoints:

- `POST /`: Insert a batch of signed data.
  - The batch is validated for consistency and data integrity errors. If there is any issue during this step, the whole
    batch is rejected. Otherwise the batch is accepted.
- `GET /{endpoint-name}/{airnode}`: Retrieve signed data for the Airnode respecting the endpoint configuration.
  - Only returns the freshest signed data available for the given Airnode, respecting the configured endpoint delay.
- `GET /`: Retrieve list of all available Airnode address.
  - Returns all Airnode addresses for which there is signed data. It is possible that this data cannot be shown by the
    delayed endpoints (in case the data is too fresh and there is not an older alternative).

## Local development

Spin up local `express` server:

```bash
pnpm run dev
```

## Docker

The API is also dockerized. Docker needs to publish the port of the server (running inside the docker) to the port on
the host machine. By default, it expects the server is running on port `8090` and publishes it to the `8090` on the
host. To change this, you need to modify both `signed-api.json` configuration and use `PORT` environment variable with
the same value.

In order to run the API from a docker, run:

```bash
# Starts the API on port 8090
pnpm run docker:start
# Or in a detached mode
pnpm run docker:detach:start
# Optionally specify port (also make sure the same port is specified inside `signed-api.json`)
PORT=5123 pnpm run docker:start
```

### Examples

Here are some examples of how to use the API with `curl`. Note, the port may differ based on the configuration.

```bash
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
