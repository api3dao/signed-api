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
# Debugging tips (assuming CWD = ./packages/pusher):
#   1. Build: docker build --target pusher --tag pusher:latest ../../
#   2. Inspect: docker run -it --init -v $(pwd)/config:/app/config --env-file .env --entrypoint /bin/sh pusher:latest
# The above commands will allow you to inspect the output of the build stage. You can change the target to debug other
# stages and verify that the image is correct.

# We use the alpine image because of its small size. The alternative considered was the "slim" image, but it is larger
# and we already use alpine (without issues) in other projects, so the size reduction seems worth it.
FROM node:18-alpine AS build
WORKDIR /app
RUN npm install -g pnpm
# Copy just the "pnpm-lock.yaml" file and use "pnpm fetch" to download all dependencies just from the lockfile. This
# command is specifically designed to improve building a docker image because it only installs the dependencies if the
# lockfile has changed (otherwise uses the cached value).
COPY pnpm-lock.yaml /app
RUN pnpm fetch
# Copies all of the contents (without files listed in .dockerignore) of the monorepo into the image.
COPY . /app
# Ideally, we would use "--offline" option, but it seems pnpm has a bug. Fortunately, the instalation times are similar.
# See: https://github.com/pnpm/pnpm/issues/6058 for details.
RUN pnpm install --recursive --prefer-offline
# Build all packages in the monorepo.
RUN pnpm run --recursive build

# Create a separate stage for pusher package. We create a temporary stage for deployment and then copy the result into
# the final stage. Only the production dependencies and package implementation is part of this last stage.
FROM build AS deployed-pusher
RUN pnpm --filter=pusher --prod deploy deployed-pusher
FROM node:18-alpine as pusher
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deployed-pusher /app/deployed-pusher .
# Enabling source maps adds small runtime overhead, but improves debugging experience and the performance is worth it.
ENTRYPOINT ["node", "--enable-source-maps", "dist/index.js"]

# Create a separate stage for api package. We create a temporary stage for deployment and then copy the result into
# the final stage. Only the production dependencies and package implementation is part of this last stage.
FROM build AS deployed-api
RUN pnpm --filter=api --prod deploy deployed-api
FROM node:18-alpine as api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deployed-api /app/deployed-api .
# Enabling source maps adds small runtime overhead, but improves debugging experience and the performance is worth it.
ENTRYPOINT ["node", "--enable-source-maps", "dist/index.js"]