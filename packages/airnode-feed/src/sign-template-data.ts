import type { ExtractedAndEncodedResponse } from '@api3/airnode-adapter';
import { go } from '@api3/promise-utils';
import { isNil } from 'lodash';

import { logger } from './logger';
import { getState } from './state';
import { signWithTemplateId } from './utils';
import type { SignedData, TemplateId } from './validation/schema';

export type SignedResponse = [TemplateId, SignedData];

export type TemplateResponse = [TemplateId, { timestamp: string; encodedResponse: ExtractedAndEncodedResponse }];

export const signTemplateResponses = async (templateResponses: TemplateResponse[]) => {
  logger.debug('Signing template responses.', { templateResponses });

  const signPromises = templateResponses.map(async ([templateId, response]) => {
    const {
      timestamp,
      encodedResponse: { encodedValue },
    } = response;

    const goSignWithTemplateId = await go(async () =>
      signWithTemplateId(getState().airnodeWallet, templateId, timestamp, encodedValue)
    );
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
        signature: goSignWithTemplateId.data,
      },
    ];
  });
  const signedResponsesOrNull = await Promise.all(signPromises);
  return signedResponsesOrNull.filter((response): response is SignedResponse => !isNil(response));
};
