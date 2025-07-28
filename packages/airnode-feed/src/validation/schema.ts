import * as abi from '@api3/airnode-abi';
import {
  type LogFormat,
  type LogLevel,
  logFormatOptions,
  logLevelOptions,
  preProcessEndpointParameters,
} from '@api3/commons';
import { oisSchema, type OIS, type Endpoint as oisEndpoint } from '@api3/ois';
import { go, goSync } from '@api3/promise-utils';
import { ethers } from 'ethers';
import { isNil, uniqWith, isEqual, isEmpty, uniq } from 'lodash';
import { z } from 'zod';

import packageJson from '../../package.json';

export const evmIdSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/); // eslint-disable-line unicorn/better-regex
export const evmAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/); // eslint-disable-line unicorn/better-regex

export type Config = z.infer<typeof configSchema>;
export type Address = z.infer<typeof evmAddressSchema>;
export type BeaconId = z.infer<typeof evmIdSchema>;
export type TemplateId = z.infer<typeof evmIdSchema>;
export type EndpointId = z.infer<typeof evmIdSchema>;

export const parameterSchema = z.strictObject({
  name: z.string(),
  type: z.string(),
  value: z.string(),
});

export type Parameter = z.infer<typeof parameterSchema>;

export const templateSchema = z.strictObject({
  endpointId: evmIdSchema,
  parameters: z.array(parameterSchema),
});

export type Template = z.infer<typeof templateSchema>;

export const templatesSchema = z.record(evmIdSchema, templateSchema).check((ctx) => {
  const templates = ctx.value;
  for (const [templateId, template] of Object.entries(templates)) {
    // Verify that config.templates.<templateId> is valid by deriving the hash of the endpointId and parameters
    const goEncodeParameters = goSync(() => abi.encode(template.parameters));
    if (!goEncodeParameters.success) {
      ctx.issues.push({
        code: 'custom',
        message: `Unable to encode parameters: ${goEncodeParameters.error.message}`,
        path: ['templates', templateId, 'parameters'],
        input: templates,
      });
      continue;
    }

    const derivedTemplateId = ethers.utils.solidityKeccak256(
      ['bytes32', 'bytes'],
      [template.endpointId, goEncodeParameters.data]
    );
    if (derivedTemplateId !== templateId) {
      ctx.issues.push({
        code: 'custom',
        message: `Template ID "${templateId}" is invalid, expected to be ${derivedTemplateId}`,
        path: [templateId],
        input: templateId,
      });
    }
  }
});

export type Templates = z.infer<typeof templatesSchema>;

export const endpointSchema = z.strictObject({
  oisTitle: z.string(),
  endpointName: z.string(),
});

export type Endpoint = z.infer<typeof endpointSchema>;

export const endpointsSchema = z.record(z.string(), endpointSchema).check((ctx) => {
  for (const [endpointId, endpoint] of Object.entries(ctx.value)) {
    // Verify that config.endpoints.<endpointId> is valid
    // by deriving the hash of the oisTitle and endpointName

    const derivedEndpointId = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(['string', 'string'], [endpoint.oisTitle, endpoint.endpointName])
    );

    if (derivedEndpointId !== endpointId) {
      ctx.issues.push({
        code: 'custom',
        message: `Endpoint ID "${endpointId}" is invalid`,
        path: [endpointId],
        input: endpointId,
      });
    }
  }
});

export type Endpoints = z.infer<typeof endpointsSchema>;

export const beaconUpdateSchema = z.strictObject({
  beaconId: evmIdSchema,
  deviationThreshold: z.number(),
  heartbeatInterval: z.number().int(),
});

export type BeaconUpdate = z.infer<typeof beaconUpdateSchema>;

export const signedApiUpdateSchema = z.strictObject({
  templateIds: z.array(evmIdSchema),
  fetchInterval: z.number(),
});

export type SignedApiUpdate = z.infer<typeof signedApiUpdateSchema>;

export const triggersSchema = z.strictObject({
  signedApiUpdates: z.array(signedApiUpdateSchema).nonempty(),
});

export type Triggers = z.infer<typeof triggersSchema>;

const validateTemplatesReferences: z.core.CheckFn<{ templates: Templates; endpoints: Endpoints }> = (ctx) => {
  const { templates, endpoints } = ctx.value;
  for (const [templateId, template] of Object.entries(templates)) {
    const endpoint = endpoints[template.endpointId];
    if (isNil(endpoint)) {
      ctx.issues.push({
        code: 'custom',
        message: `Endpoint "${template.endpointId}" is not defined in the config.endpoints object`,
        path: ['templates', templateId, 'endpointId'],
        input: templateId,
      });
    }
  }
};

const validateOisReferences: z.core.CheckFn<{ ois: OIS[]; endpoints: Endpoints }> = (ctx) => {
  for (const [endpointId, { oisTitle, endpointName }] of Object.entries(ctx.value.endpoints)) {
    // Check existence of OIS related with oisTitle
    const oises = ctx.value.ois.filter(({ title }) => title === oisTitle);
    if (oises.length === 0) {
      ctx.issues.push({
        code: 'custom',
        message: `OIS "${oisTitle}" is not defined in the config.ois object`,
        path: ['endpoints', endpointId, 'oisTitle'],
        input: oisTitle,
      });
      continue;
    }
    // Take first OIS fits the filter rule, then check specific endpoint existence
    const ois = oises[0]!;
    const endpoints = ois.endpoints.filter(({ name }: oisEndpoint) => name === endpointName);

    if (endpoints.length === 0) {
      ctx.issues.push({
        code: 'custom',
        message: `OIS titled "${oisTitle}" doesn't have referenced endpoint ${endpointName}`,
        path: ['endpoints', endpointId, 'endpointName'],
        input: endpointName,
      });
    }
  }
};

const validateTriggerReferences: z.core.CheckFn<{
  ois: OIS[];
  endpoints: Endpoints;
  triggers: Triggers;
  templates: Templates;
  apiCredentials: ApisCredentials;
}> = async (ctx) => {
  const { ois: oises, templates, endpoints, triggers } = ctx.value;

  for (const [signedApiUpdateIndex, signedApiUpdate] of triggers.signedApiUpdates.entries()) {
    const { templateIds } = signedApiUpdate;

    // Verify all template IDs actually exist in the templates object
    const referenceErrors = templateIds.map((templateId, templateIdIndex) => {
      if (!templates[templateId]) {
        ctx.issues.push({
          code: 'custom',
          message: `Template "${templateId}" is not defined in the config.templates object`,
          path: ['triggers', 'signedApiUpdates', signedApiUpdateIndex, 'templateIds', templateIdIndex],
          input: templates,
        });
        return true;
      }
      return false;
    });
    if (referenceErrors.some(Boolean)) {
      continue; // Continue for the next signedApiUpdate
    }

    // Only perform following checks if multiple templates are specified
    if (templateIds.length > 1) {
      // All templates must reference the same endpoint
      const endpointIds = templateIds.map((templateId) => templates[templateId]!.endpointId);
      const uniqueEndpointIds = uniq(endpointIds);
      if (uniqueEndpointIds.length > 1) {
        ctx.issues.push({
          code: 'custom',
          message: `The endpoint utilized by each template must be same`,
          path: ['triggers', 'signedApiUpdates', signedApiUpdateIndex, 'templateIds'],
          input: templateIds,
        });
        continue; // Continue for the next signedApiUpdate
      }

      // Since all templates use the same endpoint, we can just check the first one
      const endpoint = endpoints[endpointIds[0]!]!;
      const ois = oises.find((o) => o.title === endpoint.oisTitle)!;
      const oisEndpoint = ois.endpoints.find((e) => e.name === endpoint.endpointName)!;

      // Skip operation effect validation if the endpoints utilizes `Skip API call` feature
      // https://github.com/api3dao/signed-api/issues/238
      if (!oisEndpoint.operation && isEmpty(oisEndpoint.fixedOperationParameters)) {
        continue; // Continue for the next signedApiUpdate
      }

      const operationPayloadPromises = templateIds.map(async (templateId) => {
        const template = templates[templateId]!;

        const endpointParameters = template.parameters.reduce((acc, parameter) => {
          return {
            ...acc,
            [parameter.name]: parameter.value,
          };
        }, {});

        const goPreProcess = await go(async () => preProcessEndpointParameters(oisEndpoint, endpointParameters));
        if (!goPreProcess.success) {
          ctx.issues.push({
            code: 'custom',
            message: `Unable to pre-process endpoint parameters: ${goPreProcess.error.message}`,
            path: ['templates', templateId, 'parameters'],
            input: endpointParameters,
          });
          return;
        }
        return goPreProcess.data;
      });

      const operationsPayloads = await Promise.all(operationPayloadPromises);

      // Verify all processed payloads are identical
      if (uniqWith(operationsPayloads, isEqual).length !== 1) {
        ctx.issues.push({
          code: 'custom',
          message: `The endpoint utilized by each template must have the same operation effect`,
          path: ['triggers', 'signedApiUpdates', signedApiUpdateIndex, 'templateIds'],
          input: templateIds,
        });
        continue; // Continue for the next signedApiUpdate
      }
    }
  }
};

export const signedApiSchema = z.strictObject({
  name: z.string(),
  url: z.url(),
  authToken: z.string().nullable(),
});

export type SignedApi = z.infer<typeof signedApiSchema>;

export const signedApisSchema = z
  .array(signedApiSchema)
  .nonempty()
  .check((ctx) => {
    const signedApis = ctx.value;
    const names = signedApis.map((api) => api.name);
    const uniqueNames = [...new Set(names)];

    if (names.length !== uniqueNames.length) {
      ctx.issues.push({
        code: 'custom',
        message: `Signed API names must be unique`,
        path: ['signedApis'],
        input: signedApis,
      });
    }
  });

export const oisesSchema = z.array(oisSchema as any); // Casting to "any" because TS falsely complains.

// TODO: Remove and use config.apiCredentialsSchema when @api3/airnode-validator has upgraded zod to v4
const apiCredentialsSchema = z
  .object({
    securitySchemeName: z.string(),
    securitySchemeValue: z.string(),
    oisTitle: z.string(),
  })
  .strict();

export const apisCredentialsSchema = z.array(apiCredentialsSchema);

export type ApisCredentials = z.infer<typeof apisCredentialsSchema>;

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
    endpoints: endpointsSchema,
    nodeSettings: nodeSettingsSchema,
    ois: oisesSchema,
    signedApis: signedApisSchema,
    templates: templatesSchema,
    triggers: triggersSchema,
  })
  .check(validateTemplatesReferences)
  .check(validateOisReferences)
  .check(validateTriggerReferences);

export const encodedValueSchema = z.string().regex(/^0x[\dA-Fa-f]{64}$/);

export const signatureSchema = z.string().regex(/^0x[\dA-Fa-f]{130}$/);

export const signedDataSchema = z.strictObject({
  templateId: evmIdSchema,
  timestamp: z.string(),
  encodedValue: encodedValueSchema,
  signature: signatureSchema,
});

export type SignedData = z.infer<typeof signedDataSchema>;

export const signedApiPayloadV1Schema = signedDataSchema.extend({
  beaconId: evmIdSchema,
  airnode: evmAddressSchema,
});

export type SignedApiPayloadV1 = z.infer<typeof signedApiPayloadV1Schema>;

export const signedApiPayloadV2Schema = signedDataSchema.extend({
  oevSignature: signatureSchema,
});

export type SignedApiPayloadV2 = z.infer<typeof signedApiPayloadV2Schema>;

export const signedApiBatchPayloadV1Schema = z.array(signedApiPayloadV1Schema);

export type SignedApiBatchPayloadV1 = z.infer<typeof signedApiBatchPayloadV1Schema>;

export const signedApiBatchPayloadV2Schema = z.strictObject({
  airnode: evmAddressSchema,
  signedData: z.array(signedApiPayloadV2Schema),
});

export type SignedApiBatchPayloadV2 = z.infer<typeof signedApiBatchPayloadV2Schema>;

export const secretsSchema = z.record(z.string(), z.string());

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
    LOGGER_ENABLED: envBooleanSchema.default(true),
    LOG_COLORIZE: envBooleanSchema.default(false),
    LOG_FORMAT: z
      .string()
      .transform((value, ctx) => {
        if (!logFormatOptions.includes(value as any)) {
          ctx.issues.push({
            code: 'custom',
            message: 'Invalid LOG_FORMAT',
            path: ['LOG_FORMAT'],
            input: value,
          });
          return;
        }

        return value as LogFormat;
      })
      .default('json'),
    LOG_HEARTBEAT: envBooleanSchema.default(true),
    LOG_LEVEL: z
      .string()
      .transform((value, ctx) => {
        if (!logLevelOptions.includes(value as any)) {
          ctx.issues.push({
            code: 'custom',
            message: 'Invalid LOG_LEVEL',
            path: ['LOG_LEVEL'],
            input: value,
          });
          return;
        }

        return value as LogLevel;
      })
      .default('info'),
  })
  .strip(); // We parse from ENV variables of the process which has many variables that we don't care about.

export type EnvConfig = z.infer<typeof envConfigSchema>;
