# signed-api

A monorepo for managing signed data. Consists of:

- [api](./packages/signed-api/README.md) - A service for storing and accessing signed data. It provides endpoints to
  handle signed data for a specific airnode.
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

Signed API and Airnode feed use [semantic versioning](https://semver.org/). Packages are published to NPM to export the
configuration schemas and various utilities. The services are dockerized and published to Docker Hub.

There is a script that automates the process of creating new NPM packages and Docker images. Full release procedure:

1. `pnpm run create-release:npm [major|minor|patch]` - The script ensures publishing happens from up-to-date `main`
   branch. It updates the package versions for `airnode-feed` and `signed-api`, updates fixtures and example files, does
   basic checks to ensure the changes are valid and creates a version commit with a git tag. The command intentionally
   does not do the publishing so that the changes can be reviewed before publishing.
2. `git show` - To inspect the changes of the version commit.
3. Run the e2e tests locally. This is not automated due to implementation complexity.
4. `pnpm run publish:airnode-feed && pnpm run publish:signed-api` - To publish Airnode feed and Signed API package to
   NPM.
5. `git push --follow-tags` - Push the tagged version commit upstream.
6. Do a GitHub release for the specific tag.
7. `pnpm run create-release:docker` - To build the Docker images and tag them correctly. The script uses the current
   package.json version so it expects the NPM release is done first.
8. The command outputs the publish instructions to push the images.
