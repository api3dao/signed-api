import * as abi from '@api3/airnode-abi';
import { config } from '@api3/airnode-validator';
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
import { z, type SuperRefinement } from 'zod';

import packageJson from '../../package.json';

export type Config = z.infer<typeof configSchema>;
export type Address = z.infer<typeof config.evmAddressSchema>;
export type BeaconId = z.infer<typeof config.evmIdSchema>;
export type TemplateId = z.infer<typeof config.evmIdSchema>;
export type EndpointId = z.infer<typeof config.evmIdSchema>;

export const parameterSchema = z.strictObject({
  name: z.string(),
  type: z.string(),
  value: z.string(),
});

export type Parameter = z.infer<typeof parameterSchema>;

export const templateSchema = z.strictObject({
  endpointId: config.evmIdSchema,
  parameters: z.array(parameterSchema),
});

export type Template = z.infer<typeof templateSchema>;

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

export type Templates = z.infer<typeof templatesSchema>;

export const endpointSchema = z.strictObject({
  oisTitle: z.string(),
  endpointName: z.string(),
});

export type Endpoint = z.infer<typeof endpointSchema>;

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

export type Endpoints = z.infer<typeof endpointsSchema>;

export const baseBeaconUpdateSchema = z.strictObject({
  deviationThreshold: z.number(),
  heartbeatInterval: z.number().int(),
});

export const beaconUpdateSchema = z
  .strictObject({
    beaconId: config.evmIdSchema,
  })
  .merge(baseBeaconUpdateSchema);

export type BeaconUpdate = z.infer<typeof beaconUpdateSchema>;

export const signedApiUpdateSchema = z.strictObject({
  templateIds: z.array(config.evmIdSchema),
  fetchInterval: z.number(),
});

export type SignedApiUpdate = z.infer<typeof signedApiUpdateSchema>;

export const triggersSchema = z.strictObject({
  signedApiUpdates: z.array(signedApiUpdateSchema).nonempty(),
});

export type Triggers = z.infer<typeof triggersSchema>;

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
        message: `OIS "${oisTitle}" is not defined in the config.ois object`,
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

  for (const [signedApiUpdateIndex, signedApiUpdate] of triggers.signedApiUpdates.entries()) {
    const { templateIds } = signedApiUpdate;

    // Verify all template IDs actually exist in the templates object
    const referenceErrors = templateIds.map((templateId, templateIdIndex) => {
      if (!templates[templateId]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Template "${templateId}" is not defined in the config.templates object`,
          path: ['triggers', 'signedApiUpdates', signedApiUpdateIndex, 'templateIds', templateIdIndex],
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
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `The endpoint utilized by each template must be same`,
          path: ['triggers', 'signedApiUpdates', signedApiUpdateIndex, 'templateIds'],
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
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unable to pre-process endpoint parameters: ${goPreProcess.error.message}`,
            path: ['templates', templateId, 'parameters'],
          });
          return;
        }
        return goPreProcess.data;
      });

      const operationsPayloads = await Promise.all(operationPayloadPromises);

      // Verify all processed payloads are identical
      if (uniqWith(operationsPayloads, isEqual).length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `The endpoint utilized by each template must have the same operation effect`,
          path: ['triggers', 'signedApiUpdates', signedApiUpdateIndex, 'templateIds'],
        });
        continue; // Continue for the next signedApiUpdate
      }
    }
  }
};

export const signedApiSchema = z.strictObject({
  name: z.string(),
  url: z.string().url(),
  authToken: z.string().nullable(),
});

export type SignedApi = z.infer<typeof signedApiSchema>;

export const signedApisSchema = z
  .array(signedApiSchema)
  .nonempty()
  .superRefine((apis, ctx) => {
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

export const oisesSchema = z.array(oisSchema as any); // Casting to "any" because TS falsely complains.

export const apisCredentialsSchema = z.array(config.apiCredentialsSchema);

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
  .superRefine(validateTemplatesReferences)
  .superRefine(validateOisReferences)
  .superRefine(validateTriggerReferences);

export const encodedValueSchema = z.string().regex(/^0x[\dA-Fa-f]{64}$/);

export const signatureSchema = z.string().regex(/^0x[\dA-Fa-f]{130}$/);

export const signedDataSchema = z.strictObject({
  templateId: config.evmIdSchema,
  timestamp: z.string(),
  encodedValue: encodedValueSchema,
  signature: signatureSchema,
});

export type SignedData = z.infer<typeof signedDataSchema>;

export const signedApiPayloadV1Schema = signedDataSchema.extend({
  beaconId: config.evmIdSchema,
  airnode: config.evmAddressSchema,
});

export type SignedApiPayloadV1 = z.infer<typeof signedApiPayloadV1Schema>;

export const signedApiPayloadV2Schema = signedDataSchema.extend({
  oevSignature: signatureSchema,
});

export type SignedApiPayloadV2 = z.infer<typeof signedApiPayloadV2Schema>;

export const signedApiBatchPayloadV1Schema = z.array(signedApiPayloadV1Schema);

export type SignedApiBatchPayloadV1 = z.infer<typeof signedApiBatchPayloadV1Schema>;

export const signedApiBatchPayloadV2Schema = z.strictObject({
  airnode: config.evmAddressSchema,
  signedData: z.array(signedApiPayloadV2Schema),
});

export type SignedApiBatchPayloadV2 = z.infer<typeof signedApiBatchPayloadV2Schema>;

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
    LOG_HEARTBEAT: envBooleanSchema.default('true'),
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
