# e2e

> End to end test utilizing Mock API, pusher and signed API.

## Getting started

1. Copy the pusher secrets. Run `cp pusher/secrets.example.env pusher/secrets.env`. If you are using Docker Desktop, you
   need to change the URL in `pusher/secrets.env` from `localhost` to `host.docker.internal`, because pusher is running
   inside a Docker container.
2. Build the latest Docker images. Run `pnpm run docker:build` from the monorepo root. The e2e flow uses the docker
   images.
3. This module contains services (or configurations) that are integrated together. Specifically:

   - `pusher` - Contains the configuration for the pusher service.
   - `signed-api` - Contains the configuration for the signed API service.
   - `data-provider-api.ts` - Contains the configuration for the data provider API service (mocked express server).
   - `user.ts` - Contains the configuration for the user service (infinite fetch from signed API).

   You are free to modify the configurations to test different scenarios.

4. There are `start:<some-service>` scripts to start the services. It is recommended to start each service in a separate
   terminal and in this order:

   1. `pnpm run start:data-provider-api`
   2. `pnpm run start:signed-api`
   3. `pnpm run start:pusher`
   4. `pnpm run start:user`
