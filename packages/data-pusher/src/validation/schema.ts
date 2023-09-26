import { isNil, uniqWith, isEqual } from 'lodash';
import { z, SuperRefinement } from 'zod';
import { ethers } from 'ethers';
import { oisSchema, OIS, Endpoint as oisEndpoint } from '@api3/ois';
import { config } from '@api3/airnode-validator';
import * as abi from '@api3/airnode-abi';
import * as node from '@api3/airnode-node';
import { logConfigSchema } from 'signed-api/common';
import { preProcessApiSpecifications } from '../unexported-airnode-features/api-specification-processing';

export const limiterConfig = z.object({ minTime: z.number(), maxConcurrent: z.number() });

export const fetchMethodSchema = z.union([z.literal('gateway'), z.literal('api')]);

export const beaconSchema = z
  .object({
    airnode: config.evmAddressSchema,
    templateId: config.evmIdSchema,
    fetchInterval: z.number().int().positive().optional(),
    fetchMethod: fetchMethodSchema.optional(),
  })
  .strict();

export const beaconsSchema = z.record(config.evmIdSchema, beaconSchema).superRefine((beacons, ctx) => {
  Object.entries(beacons).forEach(([beaconId, beacon]) => {
    // Verify that config.beacons.<beaconId> is valid
    // by deriving the hash of the airnode address and templateId
    const derivedBeaconId = ethers.utils.solidityKeccak256(['address', 'bytes32'], [beacon.airnode, beacon.templateId]);
    if (derivedBeaconId !== beaconId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Beacon ID "${beaconId}" is invalid`,
        path: [beaconId],
      });
    }
  });
});

export const templateSchema = z
  .object({
    endpointId: config.evmIdSchema,
    parameters: z.string(),
  })
  .strict();

export const templatesSchema = z.record(config.evmIdSchema, templateSchema).superRefine((templates, ctx) => {
  Object.entries(templates).forEach(([templateId, template]) => {
    // Verify that config.templates.<templateId> is valid
    // by deriving the hash of the endpointId and parameters
    const derivedTemplateId = ethers.utils.solidityKeccak256(
      ['bytes32', 'bytes'],
      [template.endpointId, template.parameters]
    );
    if (derivedTemplateId !== templateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Template ID "${templateId}" is invalid, expected to be ${derivedTemplateId}`,
        path: [templateId],
      });
    }
  });
});

export const endpointSchema = z.object({
  oisTitle: z.string(),
  endpointName: z.string(),
});

export const endpointsSchema = z.record(endpointSchema).superRefine((endpoints, ctx) => {
  Object.entries(endpoints).forEach(([endpointId, endpoint]) => {
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
  });
});

export const baseBeaconUpdateSchema = z.object({
  deviationThreshold: z.number(),
  heartbeatInterval: z.number().int(),
});

export const beaconUpdateSchema = z
  .object({
    beaconId: config.evmIdSchema,
  })
  .merge(baseBeaconUpdateSchema)
  .strict();

export const signedApiUpdateSchema = z.object({
  signedApiName: z.string(),
  beaconIds: z.array(config.evmIdSchema),
  fetchInterval: z.number(),
  updateDelay: z.number(),
});

export const triggersSchema = z.object({
  signedApiUpdates: z.array(signedApiUpdateSchema),
});

const validateTemplatesReferences: SuperRefinement<{ beacons: Beacons; templates: Templates; endpoints: Endpoints }> = (
  config,
  ctx
) => {
  Object.entries(config.templates).forEach(([templateId, template]) => {
    // Verify that config.templates.<templateId>.endpointId is
    // referencing a valid config.endpoints.<endpointId> object

    // Only verify for `api` call endpoints
    if (
      Object.values(config.beacons).some(
        ({ templateId: tId, fetchMethod }) => fetchMethod === 'api' && tId === templateId
      )
    ) {
      const endpoint = config.endpoints[template.endpointId];
      if (isNil(endpoint)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Endpoint "${template.endpointId}" is not defined in the config.endpoints object`,
          path: ['templates', templateId, 'endpointId'],
        });
      }
    }
  });
};

const validateOisReferences: SuperRefinement<{ ois: OIS[]; endpoints: Endpoints }> = (config, ctx) => {
  Object.entries(config.endpoints).forEach(([endpointId, { oisTitle, endpointName }]) => {
    // Check existence of OIS related with oisTitle
    const oises = config.ois.filter(({ title }) => title === oisTitle);
    if (oises.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `OIS titled "${oisTitle}" is not defined in the config.ois object`,
        path: ['endpoints', endpointId, 'oisTitle'],
      });
      return;
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
  });
};

const validateTriggerReferences: SuperRefinement<{
  ois: OIS[];
  endpoints: Endpoints;
  triggers: Triggers;
  beacons: Beacons;
  templates: Templates;
  apiCredentials: ApisCredentials;
}> = async (config, ctx) => {
  const { ois, templates, endpoints, beacons, apiCredentials, triggers } = config;

  for (const signedApiUpdate of triggers.signedApiUpdates) {
    const { beaconIds } = signedApiUpdate;

    // Check only if beaconIds contains more than 1 beacon
    if (beaconIds.length > 1) {
      const operationPayloadPromises = beaconIds.map((beaconId) => {
        const beacon = beacons[beaconId];
        if (!beacon) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unable to find beacon with ID: ${beaconId}`,
            path: ['beacons'],
          });
          return;
        }
        const template = templates[beacon.templateId];
        if (!template) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unable to find template with ID: ${beacon.templateId}`,
            path: ['templates'],
          });
          return;
        }

        const parameters = abi.decode(template.parameters);
        const endpoint = endpoints[template.endpointId];
        if (!endpoint) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unable to find endpoint with ID: ${template.endpointId}`,
            path: ['endpoints'],
          });
          return;
        }

        const aggregatedApiCall = {
          parameters,
          ...endpoint,
        };

        const payload: node.ApiCallPayload = {
          type: 'http-gateway',
          config: { ois, apiCredentials },
          aggregatedApiCall,
        };

        return preProcessApiSpecifications(payload);
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

const validateBeaconsReferences: SuperRefinement<{ beacons: Beacons; templates: Templates }> = (config, ctx) => {
  Object.entries(config.beacons).forEach(([beaconId, beacon]) => {
    // Verify that config.beacons.<beaconId>.templateId is
    // referencing a valid config.templates.<templateId> object
    const template = config.templates[beacon.templateId];
    if (isNil(template)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Template ID "${beacon.templateId}" is not defined in the config.templates object`,
        path: ['beacons', beaconId, 'templateId'],
      });
    }
  });
};

export const rateLimitingSchema = z.object({
  maxGatewayConcurrency: z.number().optional(),
  minGatewayTime: z.number().optional(),
  maxProviderConcurrency: z.number().optional(),
  minProviderTime: z.number().optional(),
  minDirectGatewayTime: z.number().optional(),
  maxDirectGatewayConcurrency: z.number().optional(),
  overrides: z
    .object({
      signedDataGateways: z.record(limiterConfig).optional(), // key is Airnode address
      directGateways: z.record(limiterConfig).optional(), // key is ois title
    })
    .optional(),
});

const validateOisRateLimiterReferences: SuperRefinement<{
  ois: OIS[];
  rateLimiting?: RateLimitingConfig | undefined;
}> = (config, ctx) => {
  const directGateways = config.rateLimiting?.overrides?.directGateways ?? {};
  const oises = config?.ois ?? [];

  Object.keys(directGateways).forEach((oisTitle) => {
    if (!oises.find((ois) => ois.title === oisTitle)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `OIS Title "${oisTitle}" in rate limiting overrides is not defined in the config.ois array`,
        path: ['rateLimiting', 'overrides', 'directGateways', oisTitle],
      });
    }
  });
};

export const signedApiSchema = z.object({
  name: z.string(),
  url: z.string().url(),
});

export const signedApisSchema = z.array(signedApiSchema);

export const oisesSchema = z.array(oisSchema);

export const apisCredentialsSchema = z.array(config.apiCredentialsSchema);

export const configSchema = z
  .object({
    walletMnemonic: z.string(),
    logger: logConfigSchema,
    beacons: beaconsSchema,
    beaconSets: z.any(),
    chains: z.any(),
    gateways: z.any(),
    templates: templatesSchema,
    triggers: triggersSchema,
    signedApis: signedApisSchema,
    ois: oisesSchema,
    apiCredentials: apisCredentialsSchema,
    endpoints: endpointsSchema,
    rateLimiting: rateLimitingSchema.optional(),
  })
  .strict()
  .superRefine(validateBeaconsReferences)
  .superRefine(validateTemplatesReferences)
  .superRefine(validateOisReferences)
  .superRefine(validateOisRateLimiterReferences)
  .superRefine(validateTriggerReferences);

export const encodedValueSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
export const signatureSchema = z.string().regex(/^0x[a-fA-F0-9]{130}$/);
export const signedDataSchemaLegacy = z.object({
  data: z.object({ timestamp: z.string(), value: encodedValueSchema }),
  signature: signatureSchema,
});

export const signedDataSchema = z.object({
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
export type Beacon = z.infer<typeof beaconSchema>;
export type Beacons = z.infer<typeof beaconsSchema>;
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
export type FetchMethod = z.infer<typeof fetchMethodSchema>;
export type LimiterConfig = z.infer<typeof limiterConfig>;
export type RateLimitingConfig = z.infer<typeof rateLimitingSchema>;
export type ApisCredentials = z.infer<typeof apisCredentialsSchema>;

export const secretsSchema = z.record(z.string());

export const signedApiResponseSchema = z
  .object({
    count: z.number(),
  })
  .strict();

export type SignedApiResponse = z.infer<typeof signedApiResponseSchema>;
