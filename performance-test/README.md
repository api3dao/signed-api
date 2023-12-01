# performance-test

Basic instructions and rationale behind the performance test.

## Localhost run

> To make sure the configurations are working before doing the AWS deployments.

1. Start the Signed API:

```sh
docker run --publish 8090:80 -it --init --volume $(pwd)/signed-api:/app/config --env-file ./signed-api/.env --rm api3/signed-api:latest
```

2. Start the Airnode feed:

```sh
docker run --init --volume $(pwd)/airnode-feed:/app/config --network host --env-file ./airnode-feed/.env --rm api3/airnode-feed:latest
```

<!-- TODO: Change URL for real test -->
