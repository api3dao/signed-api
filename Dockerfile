# The common multistage Dockerfile for all packages in the monorepo. The idea is to create a "build" stage that is a
# base for building all packages. The advantage is that Docker reuses the "build" resulting in faster builds. Some pnpm
# features also make Docker caching more efficient. That said, pnpm documentation regarding Docker is not very good and
# their official example for monorepo (https://pnpm.io/docker) doesn't work at the time of writing. See also:
# - https://github.com/pnpm/pnpm/issues/3114#issuecomment-1177144513
# - https://github.com/pnpm/pnpm/issues/3114#issuecomment-1162821282
#
# Note, that Dockerfile assumes the context (path) is the root of the monorepo in order to generate the common "build"
# stage.
#
# Debugging tips (assuming CWD = ./packages/airnode-feed):
#   1. Build: docker build --target airnode-feed --tag api3/airnode-feed:latest ../../
#   2. Inspect: docker run -it --init -v $(pwd)/config:/app/config --env-file .env --entrypoint /bin/sh api3/airnode-feed:latest
# The above commands will allow you to inspect the output of the build stage. You can change the target to debug other
# stages and verify that the image is correct.

# Extract the pnpm version from the package.json file and store it in an environment variable.
FROM node:20-slim AS version-extract
WORKDIR /app
COPY package.json .
RUN apt-get update && \
    apt-get install -y jq && \
    echo "PNPM_VERSION=$(jq -r .packageManager package.json | sed 's/pnpm@//')" >> /tmp/env-vars

FROM node:20-slim AS build
WORKDIR /app
COPY --from=version-extract /tmp/env-vars /tmp/env-vars
RUN . /tmp/env-vars && npm install -g pnpm@${PNPM_VERSION}
# Copy just the "pnpm-lock.yaml" file and use "pnpm fetch" to download all dependencies just from the lockfile. This
# command is specifically designed to improve building a docker image because it only installs the dependencies if the
# lockfile has changed (otherwise uses the cached value).
COPY pnpm-lock.yaml /app
RUN pnpm fetch
# Copies all of the contents (without files listed in .dockerignore) of the monorepo into the image.
COPY . /app
# Ideally, we would use "--offline" option, but it seems pnpm has a bug. Fortunately, the installation times are similar.
# See: https://github.com/pnpm/pnpm/issues/6058 for details.
RUN pnpm install --recursive --prefer-offline
# Build all packages in the monorepo.
RUN pnpm run --recursive build

# Create a separate stage for Airnode feed package. We create a temporary stage for deployment and then copy the result
# into the final stage. Only the production dependencies and package implementation is part of this last stage.
LABEL application="airnode-feed" description="Airnode feed container"

FROM build AS deployed-airnode-feed

RUN pnpm --filter=@api3/airnode-feed --prod deploy deployed-airnode-feed
FROM node:20-slim AS airnode-feed
WORKDIR /app

# Update package lists and install wget
RUN apt-get update && \
    apt-get install --no-install-recommends -y wget ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN chown --recursive node:node /app
COPY --chown=node:node --from=deployed-airnode-feed /app/deployed-airnode-feed .
USER node
ENV NODE_ENV=production
ENTRYPOINT ["node", "dist/src/index.js"]

# Create a separate stage for signed-api package. We create a temporary stage for deployment and then copy the result
# into the final stage. Only the production dependencies and package implementation is part of this last stage.
LABEL application="signed-api" description="Signed API container"

FROM build AS deployed-signed-api

RUN pnpm --filter=@api3/signed-api --prod deploy deployed-signed-api
FROM node:20-slim AS signed-api
WORKDIR /app

# Update package lists and install wget
RUN apt-get update && \
    apt-get install --no-install-recommends -y wget ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Update package lists and install libcap
RUN apt-get update && \
    apt-get install --no-install-recommends -y libcap2-bin && \
    rm -rf /var/lib/apt/lists/*
# Set capabilities to allow Node.js to bind to well-known ports (<1024) as a non-root user
RUN setcap 'cap_net_bind_service=+ep' /usr/local/bin/node

RUN chown --recursive node:node /app
COPY --chown=node:node --from=deployed-signed-api /app/deployed-signed-api .
USER node
ENV NODE_ENV=production
ENTRYPOINT ["node", "dist/src/index.js"]
