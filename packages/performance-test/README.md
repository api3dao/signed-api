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
2. Populate the Signed API with sample data.
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
   `aws cloudformation create-stack --stack-name signed-api-<NAME> --template-body file://cloudformation.json --capabilities CAPABILITY_NAMED_IAM --region <REGION>`
   from this directory. Be sure to replace `<NAME>` (e.g. "source") and `<REGION>` (e.g. "eu-west-1") with the
   appropriate values.
6. Run `aws cloudformation delete-stack --stack-name signed-api-<NAME> --region <REGION>` to remove the Signed API.
   Replace `<NAME>` and `<REGION>` with the same values used in the deployment.

## Populating the Signed API

To populate the Signed API, we run Airnode feed(s) on the host machine. There are multiple ways to do this, one of the
least confusing is:

1. Use some existing signed API as a data source.
2. Specify the target amount of beacons per API response (e.g. 1 when there is no batching) and find the some Airnode
   with enough beacon responses.
3. Create an Airnode feed configuration that uses the existing signed API as a data source and the new Signed API as a
   target.
4. Run the Airnode feed(s) on a host machine and let it populate the target Signed API.

For example, to populate the Signed API from the Nodary pool you could use the following:

```sh
SOURCE_SIGNED_API_URL=https://pool.nodary.io \
SOURCE_SIGNED_API_ENDPOINT_PATH=/ \
BEACONS_COUNT=1 \
TARGET_SIGNED_API_URL=http://signed-api-elb-source-45327119.eu-west-1.elb.amazonaws.com/ \
FETCH_INTERVAL=86400 \
AIRNODE_FEED_CONFIG_PATH=./airnode-feed/populate-source-api/config/airnode-feed.json \
pnpm run run-script ./airnode-feed/create-airnode-feed-config.ts
```

To run the Airnode feed(s) you can use the `start-airnode-feeds.ts`. You can specify `TOTAL_AIRNODE_FEEDS` for how many
Airnode feeds should be run. Each Airnode feed will use a different mnemonic. For example:

```sh
TOTAL_AIRNODE_FEEDS=1 \
pnpm run run-script ./airnode-feed/populate-source-api/start-airnode-feeds.ts
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
7. TODO: Deploy and remove
