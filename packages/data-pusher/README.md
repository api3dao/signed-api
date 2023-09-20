# data-pusher

A service for storing and accessing signed data.

## Local development

TODO: How to run locally.

## Docker

The data pusher is also dockerized. The dockerized pusher needs expects environment variable `CONFIG_PATH` to be
defined, pointing to a directory with `pusher.json` and `secrets.env` files.

In order to run the pusher from a docker, run:

```bash
CONFIG_PATH=$(pwd)/config pnpm run docker:start
# or in a detached mode
CONFIG_PATH=$(pwd)/config pnpm run docker:detach:start
```

To stop a running pusher in a detached mode, run:

```bash
pnpm run docker:stop
```

### Development only docker instructions

By default the `CONFIG_PATH` is points to the `data-pusher/config` directory. This means it's possible to run:

```bash
pnpm run docker:build
# or
pnpm run docker:start
```

without the need to set `CONFIG_PATH` explicitly.
