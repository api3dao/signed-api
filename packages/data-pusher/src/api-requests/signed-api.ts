import * as node from '@api3/airnode-node';
import { go } from '@api3/promise-utils';
import axios, { AxiosError } from 'axios';
import { isEmpty, isNil } from 'lodash';
import { ethers } from 'ethers';
import { getLogger } from '../logger';
import { getState } from '../state';
import { SignedApiNameUpdateDelayGroup } from '../update-signed-api';
import { SignedApiPayload, SignedData, TemplateId } from '../validation/schema';
import { signWithTemplateId } from '../utils';

type TemplateResponse = [TemplateId, node.HttpGatewayApiCallSuccessResponse];
type TemplateResponses = TemplateResponse[];
type SignedResponse = [TemplateId, SignedData];

export const postSignedApiData = async (group: SignedApiNameUpdateDelayGroup) => {
  const {
    config: { beacons, signedApis },
    templateValues,
  } = getState();
  const { providerName, beaconIds, updateDelay } = group;

  const logOptions = { meta: { Provider: providerName, 'Update-delay': updateDelay.toString() } };

  const provider = signedApis.find((a) => a.name === providerName)!;

  const batchPayloadOrNull = beaconIds.map((beaconId): SignedApiPayload | null => {
    const { templateId, airnode } = beacons[beaconId]!;
    const delayedSignedData = templateValues[templateId]!.get(updateDelay);
    if (isNil(delayedSignedData)) return null;
    return { airnode, templateId, beaconId, ...delayedSignedData };
  });

  const batchPayload = batchPayloadOrNull.filter((payload): payload is SignedApiPayload => !isNil(payload));

  if (isEmpty(batchPayload)) {
    getLogger().debug('No batch payload found to post skipping.', logOptions);
    return;
  }
  const goRes = await go<Promise<{ count: number }>, AxiosError>(async () => {
    const axiosResponse = await axios.post(provider.url, batchPayload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return axiosResponse.data;
  });

  if (!goRes.success) {
    getLogger().warn(
      // See: https://axios-http.com/docs/handling_errors
      `Failed to post payload to update signed API. Err: ${goRes.error}, axios response: ${goRes.error.response}`,
      logOptions
    );
    return;
  }
  getLogger().info(`Pushed ${goRes.data.count.toString()} signed data updates to the pool.`, logOptions);
};

export const signTemplateResponses = async (templateResponses: TemplateResponses) => {
  const signPromises = templateResponses.map(async ([templateId, response]) => {
    const encodedValue = response.data.encodedValue;
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const wallet = new ethers.Wallet(getState().walletPrivateKey);
    const goSignWithTemplateId = await go(() => signWithTemplateId(wallet, templateId, timestamp, encodedValue));
    if (!goSignWithTemplateId.success) {
      const message = `Failed to sign response. Error: "${goSignWithTemplateId.error}"`;
      getLogger().warn(message, {
        meta: { 'Template-ID': templateId },
      });
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
