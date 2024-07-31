import type { ExtractedAndEncodedResponse } from '@api3/airnode-adapter';
import { go } from '@api3/promise-utils';
import { ethers } from 'ethers';
import { isNil } from 'lodash';

import { logger } from './logger';
import { getState } from './state';
import { signWithTemplateId } from './utils';
import type { SignedApiPayloadV2, TemplateId } from './validation/schema';

export type SignedResponse = [TemplateId, SignedApiPayloadV2];

export type TemplateResponse = [TemplateId, { timestamp: string; encodedResponse: ExtractedAndEncodedResponse }];

export const signTemplateResponses = async (templateResponses: TemplateResponse[]) => {
  logger.debug('Signing template responses.', { templateResponses });

  const signPromises = templateResponses.map(async ([templateId, response]) => {
    const {
      timestamp,
      encodedResponse: { encodedValue },
    } = response;

    const goSignWithTemplateId = await go(async () => {
      const oevTemplateId = ethers.utils.solidityKeccak256(['bytes32'], [templateId]); // TODO: Cache this
      return {
        baseSignature: await signWithTemplateId(getState().airnodeWallet, templateId, timestamp, encodedValue),
        oevSignature: await signWithTemplateId(getState().airnodeWallet, oevTemplateId, timestamp, encodedValue),
      };
    });
    if (!goSignWithTemplateId.success) {
      logger.warn(`Failed to sign response.`, {
        templateId,
        cause: goSignWithTemplateId.error.message,
      });
      return null;
    }

    return [
      templateId,
      {
        timestamp,
        encodedValue,
        signature: goSignWithTemplateId.data.baseSignature,
        oevSignature: goSignWithTemplateId.data.oevSignature,
      },
    ];
  });
  const signedResponsesOrNull = await Promise.all(signPromises);
  return signedResponsesOrNull.filter((response): response is SignedResponse => !isNil(response));
};
