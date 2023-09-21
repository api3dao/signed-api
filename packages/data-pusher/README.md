# data-pusher

A service for storing and accessing signed data.

## Local development

The pusher needs a configuration in order to run. The `config` folder contains example configuration which uses:

- [Nodary](https://nodary.io/) as the data provider, from which the data is fetched.
- Signed API running on `http://localhost:8090` where the data is pushed.

To start the the pusher in dev mode run the following:

1. `cp pusher.example.json pusher.json` - To copy the pusher configuration from the example. Note, the `pusher.json`
   file is ignored by git.
2. `cp secrets.example.env secrets.env` - To copy the secrets.env needed for the configuration. This file is also
   ignored by git.
3. Set the `NODARY_API_KEY` inside the secrets file.
4. `pnpm run dev` - To run the pusher. This step assumes already running signed API as specified in the `pusher.json`
   configuration.

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
