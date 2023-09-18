# Step 1: Build the TypeScript application
FROM node:18-alpine AS builder

WORKDIR /usr/src/app
COPY pnpm-lock.yaml package.json .
COPY . .
RUN npm install -g pnpm
RUN pnpm install --recursive --filter api
RUN pnpm run --filter api tsc

# Step 2: Run the built application
FROM node:18-alpine

WORKDIR /usr/src/app/packages/api
COPY --from=builder /usr/src/app/packages/api/dist ./dist
COPY --from=builder /usr/src/app/packages/api/package.json .
COPY pnpm-lock.yaml .
RUN npm install -g pnpm
RUN pnpm install --prod

EXPOSE 3000
CMD [ "node", "dist/src/local-server.js" ]
