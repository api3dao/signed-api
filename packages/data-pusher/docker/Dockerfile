# Step 1: Build the TypeScript application.
FROM node:18-alpine AS builder

WORKDIR /usr/src/app
# Assumes the context is the root of the monorepo. Copies all of the contents (without files listed in .dockerignore) of
# the monorepo into the image.
COPY . .
RUN npm install -g pnpm
# Installs all dependencies only for the data-pusher package.
RUN pnpm install --recursive --filter data-pusher
# Builds the data-pusher package.
RUN pnpm run --filter data-pusher build

# Step 2: Run the built application.
FROM node:18-alpine

WORKDIR /usr/src/app/packages/data-pusher
# Copies the built application from the builder image.
COPY --from=builder /usr/src/app/packages/data-pusher/dist ./dist
# Copies the package.json from the builder image.
COPY --from=builder /usr/src/app/packages/data-pusher/package.json .
# This Dockerfile copies the pnpm-lock.yaml file from the monorepo root to install locked dependency versions. This
# guarantees consistency by utilizing identical sets of dependencies.
COPY pnpm-lock.yaml .
RUN npm install -g pnpm
# Only install dependencies for production (ignore "devDependencies" section in package.json).
RUN pnpm install --prod

CMD [ "node", "dist/src/index.js" ]
