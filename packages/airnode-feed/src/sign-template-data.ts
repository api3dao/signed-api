import type { ExtractedAndEncodedResponse } from '@api3/airnode-adapter';
import { go } from '@api3/promise-utils';
import { isNil } from 'lodash';

import { logger } from './logger';
import { getState } from './state';
import { signWithTemplateId } from './utils';
import type { SignedData, TemplateId } from './validation/schema';

export type SignedResponse = [TemplateId, SignedData];

export type TemplateResponse = [TemplateId, ExtractedAndEncodedResponse];

export const signTemplateResponses = async (templateResponses: TemplateResponse[]) => {
  logger.debug('Signing template responses', { templateResponses });

  const signPromises = templateResponses.map(async ([templateId, response]) => {
    const { encodedValue } = response;
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const goSignWithTemplateId = await go(async () =>
      signWithTemplateId(getState().airnodeWallet, templateId, timestamp, encodedValue)
    );
    if (!goSignWithTemplateId.success) {
      const message = `Failed to sign response. Error: "${goSignWithTemplateId.error.message}"`;
      logger.warn(message, {
        templateId,
      });
      return null;
    }

    return [
      templateId,
      {
        timestamp,
        encodedValue,
        signature: goSignWithTemplateId.data,
      },
    ];
  });
  const signedResponsesOrNull = await Promise.all(signPromises);
  const signedResponses = signedResponsesOrNull.filter((response): response is SignedResponse => !isNil(response));

  return signedResponses;
};
