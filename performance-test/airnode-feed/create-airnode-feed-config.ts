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
      url: 'http://signed-api-elb-1476980402.eu-central-1.elb.amazonaws.com/',
    },
  ],
  ois: [
    {
      oisFormat: '2.3.0',
      title: 'Nodary pool 1',
      version: '0.2.0',
      apiSpecifications: {
        components: {
          securitySchemes: {},
        },
        paths: {
          // NOTE: Will be populated by the script.
        } as any,
        servers: [{ url: 'https://cloudflare-nodary-layer1.emanuel-tesar.workers.dev/' }],
        security: {},
      },
      endpoints: [
        // NOTE: Will be populated by the script.
      ] as any[],
    },
    {
      oisFormat: '2.3.0',
      title: 'Nodary pool 2',
      version: '0.2.0',
      apiSpecifications: {
        components: {
          securitySchemes: {},
        },
        paths: {
          // NOTE: Will be populated by the script.
        } as any,
        servers: [{ url: 'https://cloudflare-nodary-layer2.emanuel-tesar.workers.dev/' }],
        security: {},
      },
      endpoints: [
        // NOTE: Will be populated by the script.
      ] as any[],
    },
    {
      oisFormat: '2.3.0',
      title: 'Nodary pool 3',
      version: '0.2.0',
      apiSpecifications: {
        components: {
          securitySchemes: {},
        },
        paths: {
          // NOTE: Will be populated by the script.
        } as any,
        servers: [{ url: 'https://cloudflare-nodary-layer3.emanuel-tesar.workers.dev/' }],
        security: {},
      },
      endpoints: [
        // NOTE: Will be populated by the script.
      ] as any[],
    },
    {
      oisFormat: '2.3.0',
      title: 'Nodary pool 4',
      version: '0.2.0',
      apiSpecifications: {
        components: {
          securitySchemes: {},
        },
        paths: {
          // NOTE: Will be populated by the script.
        } as any,
        servers: [{ url: 'https://cloudflare-nodary-layer4.emanuel-tesar.workers.dev/' }],
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
  let count = 0;
  for (const [airnodeIndex, availableAirnode] of availableAirnodes.entries()) {
    const airnode = availableAirnode;
    const signedDatasResponse = await fetch(`https://pool.nodary.io/${airnode}`).then((res) => res.json() as any);
    const signedDatas = signedDatasResponse.data;
    if (Object.keys(signedDatas).length < 100) {
      console.info('Skipping this Airnode because it does not have enough beacons');
      continue;
    }
    if (count++ === 3) break;

    console.info(`Creating configuration for ${airnode}.`);

    // Create OIS endpoint and API specification path.
    const endpoint = {
      ...endpointTemplate,
      name: airnode,
      operation: { method: 'get', path: `/${airnode}` },
    };
    for (const ois of configTemplate.ois) {
      ois.endpoints.push(endpoint);
      ois.apiSpecifications.paths[`/${airnode}`] = { get: { parameters: [] } };
    }

    // Create endpoint.
    const oisIndex = airnodeIndex % configTemplate.ois.length;
    const endpointId = deriveEndpointId(configTemplate.ois[oisIndex]!.title, endpoint.name);
    configTemplate.endpoints[endpointId] = {
      endpointName: endpoint.name,
      oisTitle: configTemplate.ois[oisIndex]!.title,
    };

    // Create template(s).
    const templateIds: string[] = [];
    for (const beaconId of Object.keys(signedDatas).slice(0, 100)) {
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
      fetchInterval: 1, // Set to a larger value so that we don't spam the Nodary pool API that much because it rate limits us.
      updateDelay: 0,
    });
  }

  console.info('Writing configuration to "airnode-feed.json".');
  writeFileSync(join(__dirname, 'airnode-feed.json'), `${JSON.stringify(configTemplate, null, 2)}\n`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void main();
