import AWS from 'aws-sdk';
import { CreateTableInput } from 'aws-sdk/clients/dynamodb';

const localAWSConfig = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'local',
  endpoint: 'http://localhost:8000',
};

AWS.config.update(localAWSConfig);

const ddbClient = new AWS.DynamoDB();

export const POOL_TABLE_SCHEMA = {
  TableName: 'signedDataPool',
  KeySchema: [
    { AttributeName: 'airnode', KeyType: 'HASH' },
    { AttributeName: 'templateId', KeyType: 'RANGE' },
  ],
  AttributeDefinitions: [
    { AttributeName: 'airnode', AttributeType: 'S' },
    { AttributeName: 'templateId', AttributeType: 'S' },
  ],
  ProvisionedThroughput: {
    ReadCapacityUnits: 1,
    WriteCapacityUnits: 1,
  },
};

export async function createTable(params: CreateTableInput) {
  console.log('Creating table with params: ', params);
  try {
    await ddbClient.createTable(params).promise();
  } catch (e) {
    console.error('Unable to create table. Error JSON:', JSON.stringify(e, null, 2));
  }
  console.log('Created table ', params.TableName);
}

(async () => createTable(POOL_TABLE_SCHEMA))().then();
