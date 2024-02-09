import type { AxiosResponse } from 'axios';
import { ethers } from 'ethers';
import { omit } from 'lodash';

import packageJson from '../package.json';
import {
  type HeartbeatPayload,
  createConfigHash,
  stringifyUnsignedHeartbeatPayload,
} from '../src/heartbeat/heartbeat-utils';
import type { SignedResponse, TemplateResponse } from '../src/sign-template-data';
import type { Config } from '../src/validation/schema';

export const config: Config = {
  templates: {
    '0xcc35bd1800c06c12856a87311dd95bfcbb3add875844021d59a929d79f3c99bd': {
      endpointId: '0x3528e42b017a5fbf9d2993a2df04efc3ed474357575065a111b054ddf9de2acc',
      parameters: [{ type: 'string32', name: 'name', value: 'WTI/USD' }],
    },
    '0x086130c54864b2129f8ac6d8d7ab819fa8181bbe676e35047b1bca4c31d51c66': {
      endpointId: '0x3528e42b017a5fbf9d2993a2df04efc3ed474357575065a111b054ddf9de2acc',
      parameters: [{ type: 'string32', name: 'name', value: 'XAG/USD' }],
    },
    '0x1d65c1f1e127a41cebd2339f823d0290322c63f3044380cbac105db8e522ebb9': {
      endpointId: '0x3528e42b017a5fbf9d2993a2df04efc3ed474357575065a111b054ddf9de2acc',
      parameters: [{ type: 'string32', name: 'name', value: 'XAU/USD' }],
    },
  },
  endpoints: {
    '0x3528e42b017a5fbf9d2993a2df04efc3ed474357575065a111b054ddf9de2acc': {
      endpointName: 'feed',
      oisTitle: 'Nodary',
    },
  },
  triggers: {
    signedApiUpdates: [
      {
        signedApiName: 'localhost',
        templateIds: [
          '0xcc35bd1800c06c12856a87311dd95bfcbb3add875844021d59a929d79f3c99bd',
          '0x086130c54864b2129f8ac6d8d7ab819fa8181bbe676e35047b1bca4c31d51c66',
          '0x1d65c1f1e127a41cebd2339f823d0290322c63f3044380cbac105db8e522ebb9',
        ],
        fetchInterval: 5,
        updateDelay: 5,
      },
    ],
  },
  signedApis: [
    {
      name: 'localhost',
      url: 'http://localhost:8090',
      authToken: null,
    },
  ],
  ois: [
    {
      oisFormat: '2.3.0',
      title: 'Nodary',
      version: '0.2.0',
      apiSpecifications: {
        components: {
          securitySchemes: {
            NodarySecurityScheme1ApiKey: { in: 'header', name: 'x-nodary-api-key', type: 'apiKey' },
          },
        },
        paths: {
          '/feed/latest': { get: { parameters: [{ in: 'query', name: 'name' }] } },
          '/feed/latestV2': { get: { parameters: [{ in: 'query', name: 'names' }] } },
        },
        servers: [{ url: 'https://api.nodary.io' }],
        security: { NodarySecurityScheme1ApiKey: [] },
      },
      endpoints: [
        {
          fixedOperationParameters: [],
          name: 'feed',
          operation: { method: 'get', path: '/feed/latestV2' },
          parameters: [{ name: 'name', operationParameter: { in: 'query', name: 'names' } }],
          reservedParameters: [
            { name: '_type', fixed: 'int256' },
            { name: '_times', fixed: '1000000000000000000' },
          ],
          preProcessingSpecifications: [
            {
              environment: 'Node',
              value: 'const output = {};',
              timeoutMs: 5000,
            },
          ],
          postProcessingSpecifications: [
            {
              environment: 'Node',
              value: 'const output = input[endpointParameters.name].value;',
              timeoutMs: 5000,
            },
          ],
        },
      ],
    },
  ],
  apiCredentials: [
    {
      oisTitle: 'Nodary',
      securitySchemeName: 'NodarySecurityScheme1ApiKey',
      securitySchemeValue: 'invalid-api-key',
    },
  ],
  nodeSettings: {
    nodeVersion: packageJson.version,
    airnodeWalletMnemonic: 'diamond result history offer forest diagram crop armed stumble orchard stage glance',
    stage: 'test',
  },
};

export const nodaryTemplateRequestResponseData = {
  data: {
    'WTI/USD': { value: 89.06, timestamp: 1_695_727_965_885, category: 'commodity' },
    'XAG/USD': { value: 23.015_25, timestamp: 1_695_728_005_891, category: 'commodity' },
    'XAU/USD': { value: 1912.425, timestamp: 1_695_728_005_891, category: 'commodity' },
  },
} as AxiosResponse;

export const nodaryTemplateRequestError = new Error('Invalid API key');

export const nodaryTemplateResponses: TemplateResponse[] = [
  [
    '0xcc35bd1800c06c12856a87311dd95bfcbb3add875844021d59a929d79f3c99bd',
    {
      timestamp: '1674172800',
      encodedResponse: {
        encodedValue: '0x000000000000000000000000000000000000000000000004d3f4ae23d04a0000',
        rawValue: 89.06,
        values: ['89060000000000000000'],
      },
    },
  ],
  [
    '0x086130c54864b2129f8ac6d8d7ab819fa8181bbe676e35047b1bca4c31d51c66',
    {
      timestamp: '1674172800',
      encodedResponse: {
        encodedValue: '0x0000000000000000000000000000000000000000000000013f6697ef5acf2000',
        rawValue: 23.015_25,
        values: ['23015250000000000000'],
      },
    },
  ],
  [
    '0x1d65c1f1e127a41cebd2339f823d0290322c63f3044380cbac105db8e522ebb9',
    {
      timestamp: '1674172800',
      encodedResponse: {
        encodedValue: '0x000000000000000000000000000000000000000000000067ac3a7509c06a8000',
        rawValue: 1912.425,
        values: ['1912425000000000000000'],
      },
    },
  ],
];

export const nodarySignedTemplateResponses: SignedResponse[] = [
  [
    '0xcc35bd1800c06c12856a87311dd95bfcbb3add875844021d59a929d79f3c99bd',
    {
      encodedValue: '0x000000000000000000000000000000000000000000000004d3f4ae23d04a0000',
      signature:
        '0xaa5f77b3141527b67903699c77f2fd66e1cdcdb71c7d586addc4e5f6b0a5ca25537495389753795b6c23240a45bb5a1295a9c2aa526385702c54863a0f94f45d1c',
      timestamp: '1674172800', // 2023-01-20
    },
  ],
  [
    '0x086130c54864b2129f8ac6d8d7ab819fa8181bbe676e35047b1bca4c31d51c66',
    {
      encodedValue: '0x0000000000000000000000000000000000000000000000013f6697ef5acf2000',
      signature:
        '0x99878ea2e49e238d11f3c81b5232779b2a87c71e6007b35fccef107b5a2ebab23accd2d2db4d7de25014a513645cb91fdc959487496299750f069bdfabc714da1b',
      timestamp: '1674172800', // 2023-01-20
    },
  ],
  [
    '0x1d65c1f1e127a41cebd2339f823d0290322c63f3044380cbac105db8e522ebb9',
    {
      encodedValue: '0x000000000000000000000000000000000000000000000067ac3a7509c06a8000',
      signature:
        '0x9f48048354e4716077bb0c9201ae0c59f8ae29c754f272f9ed376cd22535526a5df1d3fb6397b4e7391b6317deb1e223f32f94f9c66b3f3fc1af154ad0429f201c',
      timestamp: '1674172800', // 2023-01-20
    },
  ],
];

// Axios parses the response body to JSON and automatically fills other request properties which are not needed for
// testing.
export const signedApiResponse: Partial<AxiosResponse> = {
  status: 201,
  headers: {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': '*',
  },
  data: { count: 3, skipped: 1 },
};

export const verifyHeartbeatLog = (heartbeatPayload: HeartbeatPayload, rawConfig: string) => {
  // Verify that the signature is valid.
  const unsignedHeartbeatPayload = omit(heartbeatPayload, 'signature');
  const messageToSign = ethers.utils.arrayify(
    createConfigHash(stringifyUnsignedHeartbeatPayload(unsignedHeartbeatPayload))
  );
  const expectedAirnodeAddress = ethers.utils.verifyMessage(messageToSign, heartbeatPayload.signature);
  if (expectedAirnodeAddress !== heartbeatPayload.airnode) throw new Error('Invalid signature');

  // Verify that the config hash is valid.
  const expectedConfigHash = createConfigHash(rawConfig);
  if (expectedConfigHash !== heartbeatPayload.configHash) throw new Error('Invalid config hash');
};
