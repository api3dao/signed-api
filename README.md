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

## Versioning and release

Signed API and Airnode feed use [semantic versioning](https://semver.org/). Packages are published to NPM for sharing
the interfaces (e.g. configuration file schema) and the services are dockerized and published to Docker Hub. We publish
the packages together with the same version.

<!-- TODO: Test with verdaccio -->
<!-- TODO: Update the instructions -->

To release a new version:

1. `git checkout main` - Always version from `main` branch. Also, ensure that the working directory is clean (has no
   uncommitted changes).
2. `cd packages/api` - Change directory to the API package.
3. `pnpm version [major|minor|patch]` - Choose the right version bump. This will bump the version, create a git tag and
   commit it.
4. Build the docker image with tag `api3/signed-api:latest`. If running on Linux, use `pnpm run docker:build` otherwise
   use `pnpm run docker:build:amd64`.
5. `docker tag api3/signed-api:latest api3/signed-api:<MAJOR.MINOR.PATCH>` - Tag the image with the version. Replace the
   `<MAJOR.MINOR.PATCH>` with the version you just bumped (copy it from `package.json`).
6. `docker push api3/signed-api:latest && docker push api3/signed-api:<MAJOR.MINOR.PATCH>` - Push the image upstream.
   Both the latest and the versioned tag should be published.
7. `git push --follow-tags` - Push the tagged commit upstream.
