# e2e

> End to end test utilizing Mock API, Airnode feed and signed API.

## Getting started

1. Copy the Airnode feed secrets. Run `cp airnode-feed/secrets.example.env airnode-feed/secrets.env`. If you are using
   Docker Desktop, you need to change the URL in `airnode-feed/secrets.env` from `localhost` to `host.docker.internal`,
   because Airnode feed is running inside a Docker container.
2. Copy the Signed API secrets. Run `cp signed-api/secrets.example.env signed-api/secrets.env`
3. Build the latest Docker images. Run `pnpm run docker:build` from the monorepo root. The e2e flow uses the docker
   images.
4. This module contains services (or configurations) that are integrated together. Specifically:

   - `airnode-feed` - Contains the configuration for the Airnode feed service.
   - `signed-api` - Contains the configuration for the signed API service.
   - `data-provider-api.ts` - Contains the configuration for the data provider API service (mocked express server).
   - `user.ts` - Contains the configuration for the user service (infinite fetch from signed API).

   You are free to modify the configurations to test different scenarios.

5. There are `start:<some-service>` scripts to start the services. It is recommended to start each service in a separate
   terminal and in this order:

   1. `pnpm run start:data-provider-api`
   2. `pnpm run start:signed-api`
   3. `pnpm run start:airnode-feed`
   4. `pnpm run start:user`
