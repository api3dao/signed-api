import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { encode } from '@api3/airnode-abi';

import { deriveEndpointId } from '../../packages/airnode-feed/src/utils';
import { deriveTemplateId } from '../../packages/api/test/utils';

const configTemplate = {
  templates: {
    // NOTE: Will be populated by the script.
  } as any,
  endpoints: {
    // NOTE: Will be populated by the script.
  } as any,
  triggers: {
    signedApiUpdates: [
      // NOTE: Will be populated by the script.
    ] as any[],
  },
  signedApis: [
    {
      name: 'perf-test-signed-api',
      url: 'http://host.docker.internal:8090',
    },
  ],
  ois: [
    {
      oisFormat: '2.3.0',
      title: 'Nodary pool',
      version: '0.2.0',
      apiSpecifications: {
        components: {
          securitySchemes: {},
        },
        paths: {
          // NOTE: Will be populated by the script.
        } as any,
        servers: [{ url: 'https://pool.nodary.io' }],
        security: {},
      },
      endpoints: [
        // NOTE: Will be populated by the script.
      ] as any[],
    },
  ],
  apiCredentials: [],
  nodeSettings: {
    nodeVersion: '0.1.0',
    airnodeWalletMnemonic: 'destroy manual orange pole pioneer enemy detail lady cake bus shed visa',
    stage: 'performance-test',
  },
};

const endpointTemplate = {
  fixedOperationParameters: [],
  name: '<REPLACE_ME>',
  operation: { method: 'get', path: '/<REPLACE_ME>' },
  parameters: [],
  reservedParameters: [{ name: '_type', fixed: 'bytes32' }],
  preProcessingSpecificationV2: {
    environment: 'Node',
    value: '() => { return { endpointParameters: {} }; }',
    timeoutMs: 5000,
  },
  postProcessingSpecificationV2: {
    environment: 'Node',
    value:
      '({ endpointParameters, response }) => { return { response: response.data[endpointParameters.responseDataKey].encodedValue }; }',
    timeoutMs: 5000,
  },
};

async function main() {
  const availableAirnodesResponse = await fetch('https://pool.nodary.io/').then((res) => res.json() as any);
  const availableAirnodes: string[] = availableAirnodesResponse['available-airnodes'];

  console.info(`Creating configuration for ${availableAirnodesResponse.count} Airnode(s).`);
  for (const airnode of availableAirnodes) {
    console.info(`Creating configuration for ${airnode}.`);

    // Create OIS endpoint and API specification path.
    const endpoint = {
      ...endpointTemplate,
      name: airnode,
      operation: { method: 'get', path: `/${airnode}` },
    };
    configTemplate.ois[0]!.endpoints.push(endpoint);
    configTemplate.ois[0]!.apiSpecifications.paths[`/${airnode}`] = { get: { parameters: [] } };

    // Create endpoint.
    const endpointId = deriveEndpointId(configTemplate.ois[0]!.title, endpoint.name);
    configTemplate.endpoints[endpointId] = {
      endpointName: endpoint.name,
      oisTitle: configTemplate.ois[0]!.title,
    };

    // Create template(s).
    const signedDatasResponse = await fetch(`https://pool.nodary.io/${airnode}`).then((res) => res.json() as any);
    const signedDatas = signedDatasResponse.data;
    const templateIds: string[] = [];
    for (const beaconId of Object.keys(signedDatas)) {
      const template = {
        endpointId,
        parameters: [
          {
            type: 'string',
            name: 'responseDataKey',
            value: beaconId,
          },
        ],
      };
      const templateId = deriveTemplateId(endpointId, encode(template.parameters));
      templateIds.push(templateId);
      configTemplate.templates[templateId] = template;
    }

    // Create trigger.
    configTemplate.triggers.signedApiUpdates.push({
      signedApiName: 'perf-test-signed-api',
      templateIds,
      fetchInterval: 3,
      updateDelay: 0,
    });
  }

  console.info('Writing configuration to "airnode-feed.json".');
  writeFileSync(join(__dirname, 'airnode-feed.json'), `${JSON.stringify(configTemplate, null, 2)}\n`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void main();
