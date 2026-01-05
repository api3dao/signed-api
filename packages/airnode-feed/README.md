# airnode-feed

> A service for storing and accessing signed data.

Airnode feed is a Node.js service, dockerized and deployable on any cloud provider or hostable on premise. It is
continuously running two core loops:

1. `Fetch beacon data` - Each `triggers.signedApiUpdates` entry defines a group of templates. Airnode feed makes a
   template request to the API specified in the OIS to get the template data. Airnode feed's wallet is used to sign the
   responses and these are then saved to in-memory storage.
2. `Push signed beacon data to signed API` - For each `triggers.signedApiUpdates`, periodically checks the in-memory
   storage and pushes the signed data to the configured API.

## Configuration

See [configuration](./config/configuration.md) for details.

## Local development

The Airnode feed needs a configuration in order to run. The `config` folder contains example configuration which uses:

- [Nodary](https://nodary.io/) as the data provider, from which the data is fetched.
- Signed API running on `http://localhost:8090` where the data is pushed.

To start the the Airnode feed in dev mode run the following:

1. `cp config/airnode-feed.example.json config/airnode-feed.json` - To copy the Airnode feed configuration from the
   example. Note, the `airnode-feed.json` file is ignored by git. If you are using Docker Desktop, you need to change
   the URL from localhost to `host.docker.internal`. For example:

   ```jsonc
   "url": "http://host.docker.internal:8090"
   ```

2. `cp config/secrets.example.env config/secrets.env` - To copy the secrets.env needed for the configuration. This file
   is also ignored by git.
3. Set the `NODARY_API_KEY` inside the secrets file. Ask someone from development team for the key.
4. `cp .env.example .env` - To copy the example environment variables. Optionally change the defaults.
5. `pnpm run dev` - To run the Airnode feed. This step assumes already running signed API as specified in the
   `airnode-feed.json` configuration.

### Testing

To run the tests:

```sh
pnpm run test
# or to run test only from a specific files (path substring search)
pnpm run test schema
# or to enable logger (by default the logger is disabled by jest.setup.js).
LOGGER_ENABLED=true pnpm run test
```

### Docker instructions

You can use shorthands from package.json. To understand how the docker image is built, read the
[Dockerfile](../../Dockerfile).

```sh
pnpm run docker:build
pnpm run docker:run
```

## Deployment

<!-- markdown-link-check-disable -->

To deploy Airnode feed on AWS you can use the Cloud Formation template created by the API integrations team. The
template can be found in the private api-integrations repository
[here](https://github.com/api3dao/api-integrations/blob/main/data/cloudformation-template.json).

<!-- markdown-link-check-enable -->

To deploy on premise you can use the Docker image by reading the instructions below.

### Run Airnode feed with Docker

To run the Airnode feed docker image you need to:

<!-- markdown-link-check-disable -->

1. Mount config folder to `/app/config`. The folder should contain the `airnode-feed.json` and `secrets.env` files.
2. Pass the `-it --init` flags to the docker run command. This is needed to ensure the docker is stopped gracefully. See
   [this](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#handling-kernel-signals) for details.
3. Specify the `--env-file` with the path to the `.env` file containing the [ENV configuration](#environment-variables).
4. Optionally, pass the `--rm` flag to remove the container after it is stopped.
5. If running on Linux, you need to use the `--network host` to access the host network. This has no effect for Docker
   Desktop.
6. Lastly, if you are using Docker Desktop and you want to access the host machine, you need to change the host URL from
   `localhost` to `host.docker.internal` in the configuration files.

<!-- markdown-link-check-enable -->

For example:

```sh
# Assuming the current folder contains the "config" folder and ".env" file.
docker run -it --init --volume $(pwd)/config:/app/config --env-file .env --rm api3/airnode-feed:latest
```
