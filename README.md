# signed-api

A monorepo for managing signed data. Consists of:

- [api](./packages/api/README.md) - A service for storing and accessing signed data. It provides endpoints to handle
  signed data for a specific airnode.
- [common](./packages/common/README.md) - An internal-only package with common types and utilities used by other
  packages.
- [pusher](./packages/pusher/README.md) - A service for pushing data provider signed data.
- [e2e](./packages/e2e/README.md) - End to end test utilizing Mock API, pusher and signed API.

## Getting started

The repo uses `pnpm` workspaces. To install the dependencies:

```sh
pnpm install
```

and to build the packages:

```sh
pnpm run build
```

Note, that everytime you make a change to a workspace that is used as a dependency of another, you need to rebuild the
changed package (otherwise you might get weird JS/TS errors).
