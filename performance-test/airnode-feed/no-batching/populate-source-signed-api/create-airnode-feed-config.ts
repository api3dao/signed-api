import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { encode } from '@api3/airnode-abi';

import { deriveEndpointId } from '../../../../packages/airnode-feed/src/utils';
import { deriveTemplateId } from '../../../../packages/api/test/utils';

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
      url: 'http://signed-api-elb-target-id-1962349495.eu-central-1.elb.amazonaws.com/',
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
        servers: [{ url: 'http://signed-api-elb-1946820200.eu-central-1.elb.amazonaws.com' }],
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

// NOTE: The name and operation of the endpoint are populated by the script.
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
  if (!process.env.SIGNED_API_URL) throw new Error('SIGNED_API_URL is not set');
  const signedApiUrl = process.env.SIGNED_API_URL.replace(/\/+$/, '');
  if (!process.env.SIGNED_API_ENDPOINT_PATH) throw new Error('SIGNED_API_ENDPOINT_PATH is not set');
  const signedApiEndpointPath = process.env.SIGNED_API_ENDPOINT_PATH.replaceAll('/', '');
  if (!process.env.BEACONS_COUNT) throw new Error('BEACONS_COUNT is not set');
  const beaconsCount = Number(process.env.BEACONS_COUNT!);

  const availableAirnodesResponse = await fetch(signedApiUrl).then((res) => res.json() as any);
  const availableAirnodes: string[] = availableAirnodesResponse['available-airnodes'];
  console.info(`There are ${availableAirnodesResponse.count} available Airnode(s).`);

  for (const [airnodeIndex, availableAirnode] of availableAirnodes.entries()) {
    const airnode = availableAirnode;
    const signedDatasResponse = await fetch(`${signedApiUrl}/${signedApiEndpointPath}/${airnode}`).then(
      (res) => res.json() as any
    );
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
    const path = `/${signedApiEndpointPath}/${airnode}`;
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

      // Create trigger.
      configTemplate.triggers.signedApiUpdates.push({
        signedApiName: 'perf-test-signed-api',
        templateIds: [templateId],
        fetchInterval: 1, // Set to a larger value so that we don't spam the Nodary pool API that much because it rate limits us.
        updateDelay: 0,
      });
    }

    break;
  }

  console.info('Writing configuration to "airnode-feed.json".');
  writeFileSync(join(__dirname, 'airnode-feed.json'), `${JSON.stringify(configTemplate, null, 2)}\n`);
}

// eslint-disable-next-line unicorn/prefer-top-level-await
void main();
