import { PerformApiCallSuccess } from '@api3/airnode-node/dist/src/api';
import { ApiCallErrorResponse } from '@api3/airnode-node';
import { Logger } from 'signed-api/common';
import { AxiosResponse } from 'axios';
import { Config } from '../src/validation/schema';
import { SignedResponse } from '../src/api-requests/signed-api';
import { TemplateResponse } from '../src/api-requests/data-provider';

export const createMockedLogger = (): Logger => {
  return {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    child: jest.fn(),
  };
};

export const config: Config = {
  walletMnemonic: 'diamond result history offer forest diagram crop armed stumble orchard stage glance',
  rateLimiting: { maxDirectGatewayConcurrency: 25, minDirectGatewayTime: 10 },
  beacons: {
    '0xebba8507d616ed80766292d200a3598fdba656d9938cecc392765d4a284a69a4': {
      airnode: '0xbF3137b0a7574563a23a8fC8badC6537F98197CC',
      templateId: '0xcc35bd1800c06c12856a87311dd95bfcbb3add875844021d59a929d79f3c99bd',
    },
    '0x6f6acbdadaaf116c89faf0e8de1d0c7c2352b01cce7be0eb9deb126ceaefa6ba': {
      airnode: '0xbF3137b0a7574563a23a8fC8badC6537F98197CC',
      templateId: '0x086130c54864b2129f8ac6d8d7ab819fa8181bbe676e35047b1bca4c31d51c66',
    },
    '0x7944f22b40cc691a003e35db4810b41543a83781d94f706b5c0b6980e0a06ed7': {
      airnode: '0xbF3137b0a7574563a23a8fC8badC6537F98197CC',
      templateId: '0x1d65c1f1e127a41cebd2339f823d0290322c63f3044380cbac105db8e522ebb9',
    },
  },
  templates: {
    '0xcc35bd1800c06c12856a87311dd95bfcbb3add875844021d59a929d79f3c99bd': {
      endpointId: '0x3528e42b017a5fbf9d2993a2df04efc3ed474357575065a111b054ddf9de2acc',
      parameters:
        '0x31730000000000000000000000000000000000000000000000000000000000006e616d65000000000000000000000000000000000000000000000000000000005754492f55534400000000000000000000000000000000000000000000000000',
    },
    '0x086130c54864b2129f8ac6d8d7ab819fa8181bbe676e35047b1bca4c31d51c66': {
      endpointId: '0x3528e42b017a5fbf9d2993a2df04efc3ed474357575065a111b054ddf9de2acc',
      parameters:
        '0x31730000000000000000000000000000000000000000000000000000000000006e616d65000000000000000000000000000000000000000000000000000000005841472f55534400000000000000000000000000000000000000000000000000',
    },
    '0x1d65c1f1e127a41cebd2339f823d0290322c63f3044380cbac105db8e522ebb9': {
      endpointId: '0x3528e42b017a5fbf9d2993a2df04efc3ed474357575065a111b054ddf9de2acc',
      parameters:
        '0x31730000000000000000000000000000000000000000000000000000000000006e616d65000000000000000000000000000000000000000000000000000000005841552f55534400000000000000000000000000000000000000000000000000',
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
        beaconIds: [
          '0xebba8507d616ed80766292d200a3598fdba656d9938cecc392765d4a284a69a4',
          '0x6f6acbdadaaf116c89faf0e8de1d0c7c2352b01cce7be0eb9deb126ceaefa6ba',
          '0x7944f22b40cc691a003e35db4810b41543a83781d94f706b5c0b6980e0a06ed7',
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
    },
  ],
  ois: [
    {
      oisFormat: '2.1.0',
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
};

export const nodaryTemplateRequestResponseData: PerformApiCallSuccess = {
  data: {
    'WTI/USD': { value: 89.06, timestamp: 1695727965885, category: 'commodity' },
    'XAG/USD': { value: 23.01525, timestamp: 1695728005891, category: 'commodity' },
    'XAU/USD': { value: 1912.425, timestamp: 1695728005891, category: 'commodity' },
  },
};

export const nodaryTemplateRequestErrorResponse: ApiCallErrorResponse = {
  errorMessage: 'Invalid API key',
  success: false,
};

export const nodaryTemplateResponses: TemplateResponse[] = [
  [
    '0xcc35bd1800c06c12856a87311dd95bfcbb3add875844021d59a929d79f3c99bd',
    {
      data: {
        encodedValue: '0x000000000000000000000000000000000000000000000004d3f4ae23d04a0000',
        rawValue: 89.06,
        values: ['89060000000000000000'],
      },
      success: true,
    },
  ],
  [
    '0x086130c54864b2129f8ac6d8d7ab819fa8181bbe676e35047b1bca4c31d51c66',
    {
      data: {
        encodedValue: '0x0000000000000000000000000000000000000000000000013f6697ef5acf2000',
        rawValue: 23.01525,
        values: ['23015250000000000000'],
      },
      success: true,
    },
  ],
  [
    '0x1d65c1f1e127a41cebd2339f823d0290322c63f3044380cbac105db8e522ebb9',
    {
      data: {
        encodedValue: '0x000000000000000000000000000000000000000000000067ac3a7509c06a8000',
        rawValue: 1912.425,
        values: ['1912425000000000000000'],
      },
      success: true,
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
  data: { count: 3 },
};
