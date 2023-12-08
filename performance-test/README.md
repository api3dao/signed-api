# performance-test

Basic instructions and rationale behind the performance test on AWS. Some of the steps you might do directly on the host
machine, but you may be limited by the host machine performance or network bandwidth so we primary focus on the AWS. If
you want to run the services in a Docker locally - modify the commands accordingly.

## Overview

The performance test directory looks like this:

```sh
.
├── README.md
├── airnode-feed
└── signed-api
```

The `airnode-feed` and `signed-api` directory contain the configurations for the Airnode feed and Signed API
respectively. The basic instructions to run the performance test:

1. Deploy a "source" Signed API that is going to be used by Airnode feeds as a data source.
2. Populate the Signed API with sample data.
3. Deploy a "target" Signed API that Airnode feeds are going to push the signed data to. Optionally, use the "source"
   also as a "target".
4. Deploy Airnode feed(s) that fetch data from "source" and push it to "target".

## Deploying/removing CloudFormation template

You can either do so manually via AWS UI or use the CLI. The CLI is more convenient because you have to click less. To
use the CLI:

1. Install the AWS CLI.
2. Login to AWS CLI (or just paste the short-term credential ENV variables to the console).
3. Use the CLI functions `aws cloudformation create-stack` and `aws cloudformation delete-stack`.

The rest of the instructions assume you are using the CLI and are logged in.

## Deploying the Signed API

Check out the `signed-api` directory:

```sh
.
├── benchmark-signed-api.ts
├── cloudformation.json
└── signed-api.json
```

To deploy the Signed API, use the `cloudformation.json` file in the `signed-api` directory. Specifically:

1. Replace `<SIGNED_API_CONFIG_URL>` with the URL of the configuration file. You can use the GitHub remote URL of the
   `signed-api.json` file. When developing you use the file from a different branch and each time you edit the file push
   the changes upstream.
2. Make sure the template is correct.
3. Consider changing `-default-id` in to something more meaningful. This step is necessary if deploying multiple Signed
   APIs in the same region.
4. Optionally change the `CPU` and `Memory`.
5. Run
   `aws cloudformation create-stack --stack-name signed-api-<NAME> --template-body file://cloudformation.json --capabilities CAPABILITY_NAMED_IAM --region <REGION>`
   from this directory. Be sure to replace `<NAME>` (e.g. "source") and `<REGION>` (e.g. "eu-west-1") with the
   appropriate values.
6. Run `aws cloudformation delete-stack --stack-name signed-api-<NAME> --region <REGION>` to remove the Signed API.
   Replace `<NAME>` and `<REGION>` with the same values used in the deployment.
