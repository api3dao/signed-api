# signed-api

A monorepo for managing signed data. Consists of:

- [api](./packages/api/README.md) - A service for storing and accessing signed data. It provides endpoints to handle
  signed data for a specific airnode.
- [data-pusher](./packages/data-pusher/README.md) - A service for pushing data provider signed data.

## Getting started

The repo uses `pnpm` workspaces. To install the dependencies:

```sh
pnpm install
```
