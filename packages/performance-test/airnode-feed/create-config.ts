import { writeFileSync } from 'node:fs';

import { encode } from '@api3/airnode-abi';

import { deriveEndpointId } from '../../airnode-feed/src/utils';
import { deriveTemplateId } from '../../api/test/utils';

const configTemplate = {
  templates: {
    // NOTE: Will be set by the script.
  } as any,
  endpoints: {
    // NOTE: Will be set by the script.
  } as any,
  triggers: {
    signedApiUpdates: [
      // NOTE: Will be set by the script.
    ] as any[],
  },
  signedApis: [
    {
      name: 'perf-test-signed-api',
      url: '', // NOTE: The "url" will be set by the script.
    },
  ],
  ois: [
    {
      oisFormat: '2.3.0',
      title: 'API',
      version: '0.2.0',
      apiSpecifications: {
        components: {
          securitySchemes: {},
        },
        paths: {
          // NOTE: Will be set by the script.
        } as any,
        servers: [{ url: '' }], // NOTE: Will be set by the script.
        security: {},
      },
      endpoints: [
        // NOTE: Will be set by the script.
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

// NOTE: The name and operation of the endpoint are set by the script.
const endpointTemplate = {
  fixedOperationParameters: [],
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
  if (!process.env.SOURCE_SIGNED_API_URL) throw new Error('SOURCE_SIGNED_API_URL is not set');
  const sourceSignedApiUrl = process.env.SOURCE_SIGNED_API_URL.replace(/\/+$/, '');
  if (!process.env.SOURCE_SIGNED_API_ENDPOINT_PATH) throw new Error('SOURCE_SIGNED_API_ENDPOINT_PATH is not set');
  let sourceSignedApiEndpointPath = process.env.SOURCE_SIGNED_API_ENDPOINT_PATH.replace(/\/+$/, '');
  if (!sourceSignedApiEndpointPath.startsWith('/')) sourceSignedApiEndpointPath = `/${sourceSignedApiEndpointPath}`;
  if (!process.env.SIGNED_DATAS_PER_API_RESPONSE) throw new Error('SIGNED_DATAS_PER_API_RESPONSE is not set');
  const beaconsCount = Number(process.env.SIGNED_DATAS_PER_API_RESPONSE!);
  if (!process.env.TARGET_SIGNED_API_URL) throw new Error('TARGET_SIGNED_API_URL is not set');
  const targetSignedApiUrl = process.env.TARGET_SIGNED_API_URL;
  if (!process.env.FETCH_INTERVAL) throw new Error('FETCH_INTERVAL is not set');
  const fetchInterval = Number(process.env.FETCH_INTERVAL!);
  if (!process.env.AIRNODE_FEED_CONFIG_PATH) throw new Error('AIRNODE_FEED_CONFIG_PATH is not set');
  const airnodeFeedConfigPath = process.env.AIRNODE_FEED_CONFIG_PATH;
  if (!process.env.TRIGGERS_COUNT) throw new Error('TRIGGERS_COUNT is not set');
  const triggersCount = Number(process.env.TRIGGERS_COUNT!);

  // Initialize the source and target Signed API URLs.
  configTemplate.signedApis[0]!.url = targetSignedApiUrl;
  configTemplate.ois[0]!.apiSpecifications.servers[0]!.url = sourceSignedApiUrl;

  const availableAirnodesResponse = await fetch(sourceSignedApiUrl).then((res) => res.json() as any);
  const availableAirnodes: string[] = availableAirnodesResponse['available-airnodes'];
  console.info(`There are ${availableAirnodesResponse.count} available Airnode(s).`);

  let currentTriggersCount = 0;
  for (const [airnodeIndex, availableAirnode] of availableAirnodes.entries()) {
    if (currentTriggersCount === triggersCount) {
      console.info('The required number of triggers has been created.');
      break;
    }

    const airnode = availableAirnode;
    const path = sourceSignedApiEndpointPath === '/' ? `/${airnode}` : `${sourceSignedApiEndpointPath}/${airnode}`; // Trick for the old style of Signed API (e.g. legacy Nodary implementation).
    const signedDatasResponse = await fetch(`${sourceSignedApiUrl}${path}`).then((res) => res.json() as any);
    const signedDatas = signedDatasResponse.data;
    if (Object.keys(signedDatas).length < beaconsCount) {
      console.info(
        `Skipping Airnode ${airnode} because it does not have enough beacons (only ${
          Object.keys(signedDatas).length
        } of ${beaconsCount}).`
      );
      continue;
    }
    console.info(`Using Airnode ${airnode} to create the configuration.`);

    // Create OIS endpoint and API specification path.
    const endpoint = {
      ...endpointTemplate,
      name: airnode,
      operation: { method: 'get', path },
    };
    for (const ois of configTemplate.ois) {
      ois.endpoints.push(endpoint);
      ois.apiSpecifications.paths[path] = { get: { parameters: [] } };
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
    for (const beaconId of Object.keys(signedDatas).slice(0, beaconsCount)) {
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
      fetchInterval,
      updateDelay: 0,
    });
    currentTriggersCount++;
  }

  if (currentTriggersCount !== triggersCount) throw new Error('Not enough Airnodes to create the configuration.');

  console.info(`Writing configuration to: ${airnodeFeedConfigPath}.`);
  writeFileSync(airnodeFeedConfigPath, `${JSON.stringify(configTemplate, null, 2)}\n`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void main();
