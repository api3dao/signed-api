# Nodary Signature Pool

This repository contains code for a Nodary Signature Pool, which utilizes serverless infrastructure and is deployed on
AWS. It provides endpoints to handle signed data for a specific airnode.

## Technologies Used

- AWS DynamoDB: A NoSQL database service.
- AWS API Gateway: A fully managed service for creating, deploying, and managing APIs.
- AWS Lambda: A serverless computing service that runs your code in response to events.

## Getting Started

### Prerequisites

- `Node.js` and `yarn` should be installed on your machine.
- An AWS account with the necessary permissions to create and deploy the required resources.

### Installation

Clone the repository:

```bash
git clone git@github.com:nodaryio/signed-api.git
```

Install the dependencies:

```bash
cd signed-api
yarn
```

### Configuration

1. Copy `.env` from the `example.env` file.
2. Open the `.env` file and update the environment variables:
   - `HTTP_API_ID`: The ID of the HTTP API in AWS API Gateway.

### Deployment

To deploy infrastructure to AWS:

```bash
yarn deploy
```

To remove deployment:

```bash
yarn removeDeployment
```

## Public Endpoint

The Nodary Signature Pool is publicly accessible at the following endpoint:

- https://pool.nodary.io

## Usage

The API provides the following endpoints:

- `PUT /`: Upsert single signed data.
- `POST /`: Upsert batch of signed data.
- `GET /{airnode}`: Retrieve signed data for the airnode.
- `GET /`: Retrieve list of all available airnode address.

### Local development

Start local dynamodb server:

```bash
yarn dynamodb-local-up
```

Initialize tables:

```bash
yarn init-tables
```

Spin up local `express` server to mimic AWS API gateway:

```bash
yarn start-local
```

You can use following valid examples in the next section to test server.

### Examples

Here are some examples of how to use the API with `curl`:

```bash
# Upsert signed data (HTTP PUT)
curl --location --request PUT 'http://localhost:8090' \
--header 'Content-Type: application/json' \
--data '{
    "airnode": "0xc52EeA00154B4fF1EbbF8Ba39FDe37F1AC3B9Fd4",
    "beaconId": "0x70601427c8ff03560563917eed9837651ad9d6eb3414e46e8f96302c6f0aefcd",
    "templateId": "0x8f255387c5fdb03117d82372b8fa5c7813881fd9a8202b7cc373f1a5868496b2",
    "timestamp": "1694644051",
    "encodedValue": "0x000000000000000000000000000000000000000000000002eb268c108b0b1da0",
    "signature": "0x8e540abb31f6ef161153c508b9cc3909dcc3cf6596deff88ed4f9f2226fa28c61b8c23078373f64a7125035d1f70fd3befa6dfc48a31e7e15cc23133331ed9221b"
  }'

# Upsert batch of signed data (HTTP POST)
curl --location 'http://localhost:8090' \
--header 'Content-Type: application/json' \
--data '[{
    "beaconId": "0x1896e5d90edcd73e8abc3f5685cb8def4dfc1c7fef8032c4d02095a8ac5d1dba",
    "airnode": "0xc52EeA00154B4fF1EbbF8Ba39FDe37F1AC3B9Fd4",
    "templateId": "0x672fef5bbcf3bfb4c23fdf5dde28c634454e116ff9af4fb12ccf45e06c77aa75",
    "timestamp": "1694644051",
    "encodedValue": "0x00000000000000000000000000000000000000000000005718e3a22ce01f7a40",
    "signature": "0x660b8462edf5d2adf74b4dfe3a5f5ac017cf2fa3f933a78df59a446b341f858f53f4d2487fe45763c6180dadad221daeef01efc4b49038778f5865dbcf79cd0f1c"
  },
  { "airnode": "0xc52EeA00154B4fF1EbbF8Ba39FDe37F1AC3B9Fd4",
    "beaconId": "0x1e63023d28b5252da94ac707582b2b95b0e9d18fbf6ebe0cfd009967c6bf58fc",
    "templateId": "0xc938ba9dd0be0637d17830676a1e3f1292032f8e7990eac20a25c3c2a07a99dd",
    "timestamp": "1694644051",
    "encodedValue": "0x00000000000000000000000000000000000000000000000012988bbd65ac6be8",
    "signature": "0x68b460e96122a3f8addecbf5e1713169b7befe5b0b39a5b0bfdea827ca39266b2887c8a4c0c20ffd38ff9e8344766e72c3c5ed11a720b4809536ac4722ee85511c"
  }]'

# Get data for the airnode address (HTTP GET)
curl --location 'http://localhost:8090/0xc52EeA00154B4fF1EbbF8Ba39FDe37F1AC3B9Fd4' \
--header 'Content-Type: application/json'

# List available airnode addresses (HTTP GET)
curl --location 'http://localhost:8090' \
--header 'Content-Type: application/json'

```

## References

- To configure Cloudflare for caching, AWS API Gateway for custom domain support see
  [the page](https://kylebarron.dev/blog/caching-lambda-functions-cloudflare).
