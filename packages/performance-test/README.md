# performance-test

> Basic instructions and rationale behind the performance test on AWS.

Similar performance tests can be run on the host machine, but you may be bottlenecked by the host machine performance or
network bandwidth. Also the AWS side is not tested this way. For this reason the instructions here are AWS specific. If
you want to run the services in a Docker locally modify the commands accordingly.

## Overview

The `airnode-feed` and `signed-api` directory contain the configurations for the Airnode feed and Signed API
respectively. The basic instructions to run the performance test:

1. Deploy a "source" Signed API that is going to be used by Airnode feeds as a data source. This is better than spamming
   some existing API with requests.
2. Initialize the Signed API with sample data.
3. Deploy a "target" Signed API that Airnode feeds are going to push the signed data to. Optionally, use the "source"
   also as a "target".
4. Deploy Airnode feed(s) that fetch data from "source" and push it to "target".

## Deploying/removing CloudFormation template

You can either do so manually via AWS UI or use the CLI. The CLI is more convenient because you have to click less. To
use the CLI:

1. Install the AWS CLI.
2. LogID into AWS CLI (or just paste the short-term credential ENV variables to the console).
3. Use the CLI functions `aws cloudformation create-stack` and `aws cloudformation delete-stack`.

The rest of the instructions assume you are using the CLI and are logged in.

## Deploying the Signed API

To deploy the Signed API, use the `cloudformation.json` file in the `signed-api` directory. Specifically:

1. Replace `<SIGNED_API_CONFIG_URL>` with the URL of the configuration file in the CF template. You can use the GitHub
   remote URL of the `signed-api.json` file. When developing you use the file from a different branch and each time you
   edit the file push the changes upstream.
2. Make sure the template is correct.
3. Consider changing `-default-id` ID into something more meaningful. This step is necessary if deploying multiple
   Signed APIs in the same region.
4. Optionally change the `CPU` and `Memory`.
5. Run
   `aws cloudformation create-stack --stack-name signed-api-<NAME> --template-body file://signed-api/cloudformation.json --capabilities CAPABILITY_NAMED_IAM --region <REGION>`.
   Be sure to replace `<NAME>` (e.g. "source") and `<REGION>` (e.g. "eu-west-1") with the appropriate values.
6. Run `aws cloudformation delete-stack --stack-name signed-api-<NAME> --region <REGION>` to remove the Signed API.
   Replace `<NAME>` and `<REGION>` with the same values used in the deployment.

## Populating the Signed API

To initialize the Signed API, we run Airnode feed(s) on the host machine. There are multiple ways to do this, one of the
least confusing is to use some existing signed API as a data source and run multiple Airnode feeds (with different
mnemonic) with a single trigger. The number of Airnode feeds (X) and the number of templates (Y) in the trigger can be
configured as necessary. The end result is a Signed API with X endpoints each serving Y signed data.

### Create Airnode feed configuration

You can use a script to create an Airnode feed configuration. You need to:

1. Use some existing signed API and set `SOURCE_SIGNED_API_URL` and `SOURCE_SIGNED_API_ENDPOINT_PATH`.
2. Set `SIGNED_DATAS_PER_API_RESPONSE` (e.g. `1` when there is no batching, `100` to simulate API batch of 100).
3. Set `TARGET_SIGNED_API_URL` to the URL of the target Signed API.
4. Leave `TRIGGERS_COUNT` to `1` and `FETCH_INTERVAL` to `86400`. The point is to create just a single trigger and push
   the signed data only once. Set `AIRNODE_FEED_CONFIG_PATH` to
   `./airnode-feed/initialize-source-api/config/airnode-feed.json`.

For example, to initialize the Signed API from the Nodary pool you could use the following:

```sh
SOURCE_SIGNED_API_URL=https://pool.nodary.io \
SOURCE_SIGNED_API_ENDPOINT_PATH=/ \
SIGNED_DATAS_PER_API_RESPONSE=1 \
TARGET_SIGNED_API_URL=http://signed-api-elb-source-45327119.eu-west-1.elb.amazonaws.com/ \
TRIGGERS_COUNT=1 \
FETCH_INTERVAL=86400 \
AIRNODE_FEED_CONFIG_PATH=./airnode-feed/initialize-source-api/config/airnode-feed.json \
pnpm run run-script ./airnode-feed/create-config.ts
```

### Run Airnode feed(s)

To run the Airnode feed(s) you can use the `start-airnode-feeds.ts`. You can specify `TOTAL_AIRNODE_FEEDS` for how many
Airnode feeds should be run. Each Airnode feed will use a different mnemonic. For example:

```sh
TOTAL_AIRNODE_FEEDS=1 \
pnpm run run-script ./airnode-feed/initialize-source-api/start-airnode-feeds.ts
```

## Deploying the Airnode feed

To deploy the Airnode feed, use the `cloudformation.json` file in the `airnode-feed` directory. Specifically:

1. Make sure you have some "source" API and "target" API deployed.
2. Create the Airnode feed configuration and upload is somewhere (e.g. commit and push upstream on GitHub).
3. Replace `<AIRNODE_FEED_CONFIG_URL>` with the configuration URL in the `cloudformation.json` file in the CF template.
4. Make sure the template is correct.
5. Consider changing `-perf-test` ID into something more meaningful. This step is necessary if deploying multiple
   Airnode feeds in the same region.
6. Optionally change the `CPU` and `Memory`.
7. Run
   `aws cloudformation create-stack --stack-name airnode-feed-<NAME> --template-body file://airnode-feed/cloudformation.json --capabilities CAPABILITY_NAMED_IAM --region <REGION>`.
   Be sure to replace `<NAME>` (e.g. "perf-test") and `<REGION>` (e.g. "eu-west-1") with the appropriate values.
8. Run `aws cloudformation delete-stack --stack-name airnode-feed-<NAME> --region <REGION>` to remove the Signed API.
   Replace `<NAME>` and `<REGION>` with the same values used in the deployment.

### Create Airnode feed configuration

You can use a script to create an Airnode feed configuration, similarly to the "source" Signed API initialization. The
`SIGNED_DATAS_PER_API_RESPONSE` should remain the same, `TRIGGERS_COUNT` should equal to `TOTAL_AIRNODE_FEEDS`, and
`FETCH_INTERVAL` can be set arbitrarily.

For example, to create an Airnode feed configuration for for no batching case:

```sh
SOURCE_SIGNED_API_URL=http://signed-api-elb-source-45327119.eu-west-1.elb.amazonaws.com/ \
SOURCE_SIGNED_API_ENDPOINT_PATH=/0s-delay \
SIGNED_DATAS_PER_API_RESPONSE=1 \
TARGET_SIGNED_API_URL=http://signed-api-elb-target-12156456.eu-west-1.elb.amazonaws.com/ \
TRIGGERS_COUNT=300 \
FETCH_INTERVAL=1 \
AIRNODE_FEED_CONFIG_PATH=./airnode-feed/airnode-feed.json \
pnpm run run-script ./airnode-feed/create-config.ts
```

To create an Airnode feed configuration for the batching case:

```sh
SOURCE_SIGNED_API_URL=http://signed-api-elb-source-45327119.eu-west-1.elb.amazonaws.com/ \
SOURCE_SIGNED_API_ENDPOINT_PATH=/0s-delay \
SIGNED_DATAS_PER_API_RESPONSE=100 \
TARGET_SIGNED_API_URL=http://signed-api-elb-target-12156456.eu-west-1.elb.amazonaws.com/ \
TRIGGERS_COUNT=3 \
FETCH_INTERVAL=1 \
AIRNODE_FEED_CONFIG_PATH=./airnode-feed/airnode-feed.json \
pnpm run run-script ./airnode-feed/create-config.ts
```
