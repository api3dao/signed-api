# signed-api

A monorepo for managing signed data. Consists of:

- [api](./packages/api/README.md) - A service for storing and accessing signed data. It provides endpoints to handle
  signed data for a specific airnode.
- [airnode-feed](./packages/airnode-feed/README.md) - A service for pushing data provider signed data.
- [e2e](./packages/e2e/README.md) - End to end test utilizing Mock API, Airnode feed and signed API.
- [performance-test](./packages/performance-test/README.md) - Configurations and scripts to allow running performance
  tests and benchmarks on AWS.

Read the
[specification](https://docs.google.com/document/d/1-kUPIXSD4ZW1SGs_P8HsejC9k9aHB-NXs9_6-OclnmE/edit#heading=h.i307237rdfda)
for more details on the architecture and the components.

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
