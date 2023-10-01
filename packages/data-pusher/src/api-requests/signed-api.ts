import { go } from '@api3/promise-utils';
import axios, { AxiosError } from 'axios';
import { isEmpty, isNil } from 'lodash';
import { ethers } from 'ethers';
import { TemplateResponse } from './data-provider';
import { logger } from '../logger';
import { getState } from '../state';
import { SignedApiNameUpdateDelayGroup } from '../update-signed-api';
import { SignedApiPayload, SignedData, TemplateId, signedApiResponseSchema } from '../validation/schema';
import { signWithTemplateId } from '../utils';

export type SignedResponse = [TemplateId, SignedData];

export const postSignedApiData = async (group: SignedApiNameUpdateDelayGroup) => {
  const {
    config: { beacons, signedApis },
    templateValues,
  } = getState();
  const { signedApiName, beaconIds, updateDelay } = group;
  const logContext = { signedApiName, updateDelay };
  logger.debug('Posting signed API data.', { group, ...logContext });

  const provider = signedApis.find((a) => a.name === signedApiName)!;

  const batchPayloadOrNull = beaconIds.map((beaconId): SignedApiPayload | null => {
    const { templateId, airnode } = beacons[beaconId]!;
    const delayedSignedData = templateValues[templateId]!.get(updateDelay);
    if (isNil(delayedSignedData)) return null;
    return { airnode, templateId, beaconId, ...delayedSignedData };
  });

  const batchPayload = batchPayloadOrNull.filter((payload): payload is SignedApiPayload => !isNil(payload));

  if (isEmpty(batchPayload)) {
    logger.debug('No batch payload found to post. Skipping.', logContext);
    return { success: true, count: 0 };
  }
  const goAxiosRequest = await go<Promise<unknown>, AxiosError>(async () => {
    logger.debug('Posting batch payload.', { ...logContext, batchPayload });
    const axiosResponse = await axios.post(provider.url, batchPayload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return axiosResponse.data;
  });
  if (!goAxiosRequest.success) {
    logger.warn(
      `Failed to make update signed API request.`,
      // See: https://axios-http.com/docs/handling_errors
      { ...logContext, axiosResponse: goAxiosRequest.error.response }
    );
    return { success: false };
  }

  logger.debug('Parsing response from the signed API.', { ...logContext, axiosResponse: goAxiosRequest.data });
  const parsedResponse = signedApiResponseSchema.safeParse(goAxiosRequest.data);
  if (!parsedResponse.success) {
    logger.warn('Failed to parse response from the signed API.', {
      ...logContext,
      errors: parsedResponse.error,
    });
    return { success: false };
  }

  const count = parsedResponse.data.count;
  logger.info(`Pushed signed data updates to the signed API.`, { ...logContext, count });
  return { success: true, count };
};

export const signTemplateResponses = async (templateResponses: TemplateResponse[]) => {
  logger.debug('Signing template responses', { templateResponses });

  const signPromises = templateResponses.map(async ([templateId, response]) => {
    const encodedValue = response.data.encodedValue;
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const wallet = new ethers.Wallet(getState().walletPrivateKey);
    const goSignWithTemplateId = await go(() => signWithTemplateId(wallet, templateId, timestamp, encodedValue));
    if (!goSignWithTemplateId.success) {
      const message = `Failed to sign response. Error: "${goSignWithTemplateId.error}"`;
      logger.warn(message, { templateId });
      return null;
    }

    return [
      templateId,
      {
        timestamp: timestamp,
        encodedValue: encodedValue,
        signature: goSignWithTemplateId.data,
      },
    ];
  });
  const signedResponsesOrNull = await Promise.all(signPromises);
  const signedResponses = signedResponsesOrNull.filter((response): response is SignedResponse => !isNil(response));

  return signedResponses;
};
