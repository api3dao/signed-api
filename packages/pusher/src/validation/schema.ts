import * as abi from '@api3/airnode-abi';
import { config } from '@api3/airnode-validator';
import {
  type LogFormat,
  type LogLevel,
  logFormatOptions,
  logLevelOptions,
  preProcessApiCallParameters,
} from '@api3/commons';
import { oisSchema, type OIS, type Endpoint as oisEndpoint } from '@api3/ois';
import { goSync } from '@api3/promise-utils';
import { ethers } from 'ethers';
import { isNil, uniqWith, isEqual } from 'lodash';
import { z, type SuperRefinement } from 'zod';

import packageJson from '../../package.json';

export const parameterSchema = z.strictObject({
  name: z.string(),
  type: z.string(),
  value: z.string(),
});

export const templateSchema = z.strictObject({
  endpointId: config.evmIdSchema,
  parameters: z.array(parameterSchema),
});

export const templatesSchema = z.record(config.evmIdSchema, templateSchema).superRefine((templates, ctx) => {
  for (const [templateId, template] of Object.entries(templates)) {
    // Verify that config.templates.<templateId> is valid by deriving the hash of the endpointId and parameters
    const goEncodeParameters = goSync(() => abi.encode(template.parameters));
    if (!goEncodeParameters.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unable to encode parameters: ${goEncodeParameters.error.message}`,
        path: ['templates', templateId, 'parameters'],
      });
      continue;
    }

    const derivedTemplateId = ethers.utils.solidityKeccak256(
      ['bytes32', 'bytes'],
      [template.endpointId, goEncodeParameters.data]
    );
    if (derivedTemplateId !== templateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Template ID "${templateId}" is invalid, expected to be ${derivedTemplateId}`,
        path: [templateId],
      });
    }
  }
});

export const endpointSchema = z.strictObject({
  oisTitle: z.string(),
  endpointName: z.string(),
});

export const endpointsSchema = z.record(endpointSchema).superRefine((endpoints, ctx) => {
  for (const [endpointId, endpoint] of Object.entries(endpoints)) {
    // Verify that config.endpoints.<endpointId> is valid
    // by deriving the hash of the oisTitle and endpointName

    const derivedEndpointId = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['string', 'string'], [endpoint.oisTitle, endpoint.endpointName])
    );

    if (derivedEndpointId !== endpointId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Endpoint ID "${endpointId}" is invalid`,
        path: [endpointId],
      });
    }
  }
});

export const baseBeaconUpdateSchema = z.strictObject({
  deviationThreshold: z.number(),
  heartbeatInterval: z.number().int(),
});

export const beaconUpdateSchema = z
  .strictObject({
    beaconId: config.evmIdSchema,
  })
  .merge(baseBeaconUpdateSchema);

export const signedApiUpdateSchema = z.strictObject({
  signedApiName: z.string(),
  templateIds: z.array(config.evmIdSchema),
  fetchInterval: z.number(),
  updateDelay: z.number(),
});

export const triggersSchema = z.strictObject({
  signedApiUpdates: z.array(signedApiUpdateSchema),
});

const validateTemplatesReferences: SuperRefinement<{ templates: Templates; endpoints: Endpoints }> = (config, ctx) => {
  for (const [templateId, template] of Object.entries(config.templates)) {
    const endpoint = config.endpoints[template.endpointId];
    if (isNil(endpoint)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Endpoint "${template.endpointId}" is not defined in the config.endpoints object`,
        path: ['templates', templateId, 'endpointId'],
      });
    }
  }
};

const validateOisReferences: SuperRefinement<{ ois: OIS[]; endpoints: Endpoints }> = (config, ctx) => {
  for (const [endpointId, { oisTitle, endpointName }] of Object.entries(config.endpoints)) {
    // Check existence of OIS related with oisTitle
    const oises = config.ois.filter(({ title }) => title === oisTitle);
    if (oises.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `OIS titled "${oisTitle}" is not defined in the config.ois object`,
        path: ['endpoints', endpointId, 'oisTitle'],
      });
      continue;
    }
    // Take first OIS fits the filter rule, then check specific endpoint existence
    const ois = oises[0]!;
    const endpoints = ois.endpoints.filter(({ name }: oisEndpoint) => name === endpointName);

    if (endpoints.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `OIS titled "${oisTitle}" doesn't have referenced endpoint ${endpointName}`,
        path: ['endpoints', endpointId, 'endpointName'],
      });
    }
  }
};

const validateTriggerReferences: SuperRefinement<{
  ois: OIS[];
  endpoints: Endpoints;
  triggers: Triggers;
  templates: Templates;
  apiCredentials: ApisCredentials;
}> = async (config, ctx) => {
  const { ois: oises, templates, endpoints, triggers } = config;

  for (const signedApiUpdate of triggers.signedApiUpdates) {
    const { templateIds } = signedApiUpdate;

    if (templateIds.length > 1) {
      const operationPayloadPromises = templateIds.map(async (templateId) => {
        const template = templates[templateId];
        if (!template) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unable to find template with ID: ${templateId}`,
            path: ['templates'],
          });
          return;
        }

        const endpoint = endpoints[template.endpointId];
        if (!endpoint) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unable to find endpoint with ID: ${template.endpointId}`,
            path: ['endpoints'],
          });
          return;
        }

        const ois = oises.find((o) => o.title === endpoint.oisTitle)!;
        const oisEndpoint = ois.endpoints.find((e) => e.name === endpoint.endpointName)!;
        const apiCallParameters = template.parameters.reduce((acc, parameter) => {
          return {
            ...acc,
            [parameter.name]: parameter.value,
          };
        }, {});

        return preProcessApiCallParameters(oisEndpoint, apiCallParameters);
      });

      const operationsPayloads = await Promise.all(operationPayloadPromises);

      if (uniqWith(operationsPayloads, isEqual).length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `If beaconIds contains more than 1 beacon, the endpoint utilized by each beacons must have same operation effect`,
          path: ['triggers', 'signedApiUpdates', triggers.signedApiUpdates.indexOf(signedApiUpdate)],
        });
        return;
      }
    }
  }
};

export const signedApiSchema = z.strictObject({
  name: z.string(),
  url: z.string().url(),
});

export const signedApisSchema = z.array(signedApiSchema).superRefine((apis, ctx) => {
  const names = apis.map((api) => api.name);
  const uniqueNames = [...new Set(names)];

  if (names.length !== uniqueNames.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Signed API names must be unique`,
      path: ['signedApis'],
    });
  }
});

export const oisesSchema = z.array(oisSchema);

export const apisCredentialsSchema = z.array(config.apiCredentialsSchema);

export const nodeSettingsSchema = z.strictObject({
  nodeVersion: z.string().refine((version) => version === packageJson.version, 'Invalid node version'),
  airnodeWalletMnemonic: z.string().refine((mnemonic) => ethers.utils.isValidMnemonic(mnemonic), 'Invalid mnemonic'),
  stage: z
    .string()
    .regex(/^[\da-z-]{1,256}$/, 'Only lowercase letters, numbers and hyphens are allowed (max 256 characters)'),
});

export type NodeSettings = z.infer<typeof nodeSettingsSchema>;

export const configSchema = z
  .strictObject({
    apiCredentials: apisCredentialsSchema,
    beaconSets: z.any(),
    chains: z.any(),
    endpoints: endpointsSchema,
    gateways: z.any(),
    nodeSettings: nodeSettingsSchema,
    ois: oisesSchema,
    signedApis: signedApisSchema,
    templates: templatesSchema,
    triggers: triggersSchema,
  })
  .superRefine(validateTemplatesReferences)
  .superRefine(validateOisReferences)
  .superRefine(validateTriggerReferences);

export const encodedValueSchema = z.string().regex(/^0x[\dA-Fa-f]{64}$/);
export const signatureSchema = z.string().regex(/^0x[\dA-Fa-f]{130}$/);
export const signedDataSchema = z.strictObject({
  timestamp: z.string(),
  encodedValue: encodedValueSchema,
  signature: signatureSchema,
});

export const signedApiPayloadSchema = signedDataSchema.extend({
  beaconId: config.evmIdSchema,
  airnode: config.evmAddressSchema,
  templateId: config.evmIdSchema,
});

export const signedApiBatchPayloadSchema = z.array(signedApiPayloadSchema);

export type SignedApiPayload = z.infer<typeof signedApiPayloadSchema>;
export type SignedApiBatchPayload = z.infer<typeof signedApiBatchPayloadSchema>;
export type Config = z.infer<typeof configSchema>;
export type Template = z.infer<typeof templateSchema>;
export type Templates = z.infer<typeof templatesSchema>;
export type BeaconUpdate = z.infer<typeof beaconUpdateSchema>;
export type SignedApiUpdate = z.infer<typeof signedApiUpdateSchema>;
export type Triggers = z.infer<typeof triggersSchema>;
export type Address = z.infer<typeof config.evmAddressSchema>;
export type BeaconId = z.infer<typeof config.evmIdSchema>;
export type TemplateId = z.infer<typeof config.evmIdSchema>;
export type EndpointId = z.infer<typeof config.evmIdSchema>;
export type SignedData = z.infer<typeof signedDataSchema>;
export type Endpoint = z.infer<typeof endpointSchema>;
export type Endpoints = z.infer<typeof endpointsSchema>;
export type ApisCredentials = z.infer<typeof apisCredentialsSchema>;
export type Parameter = z.infer<typeof parameterSchema>;

export const secretsSchema = z.record(z.string());

export const signedApiResponseSchema = z.strictObject({
  count: z.number(),
  skipped: z.number(),
});

export type SignedApiResponse = z.infer<typeof signedApiResponseSchema>;

export const envBooleanSchema = z.union([z.literal('true'), z.literal('false')]).transform((val) => val === 'true');

// We apply default values to make it convenient to omit certain environment variables. The default values should be
// primarily focused on users and production usage.
export const envConfigSchema = z
  // Intentionally not using strictObject here because we want to allow other environment variables to be present.
  .object({
    LOGGER_ENABLED: envBooleanSchema.default('true'),
    LOG_COLORIZE: envBooleanSchema.default('false'),
    LOG_FORMAT: z
      .string()
      .transform((value, ctx) => {
        if (!logFormatOptions.includes(value as any)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid LOG_FORMAT',
            path: ['LOG_FORMAT'],
          });
          return;
        }

        return value as LogFormat;
      })
      .default('json'),
    LOG_LEVEL: z
      .string()
      .transform((value, ctx) => {
        if (!logLevelOptions.includes(value as any)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid LOG_LEVEL',
            path: ['LOG_LEVEL'],
          });
          return;
        }

        return value as LogLevel;
      })
      .default('info'),
  })
  .strip(); // We parse from ENV variables of the process which has many variables that we don't care about.

export type EnvConfig = z.infer<typeof envConfigSchema>;
