import { ethers } from 'ethers';
import { go } from '@api3/promise-utils';
import * as node from '@api3/airnode-node';
import { isNil } from 'lodash';
import { logger } from './logger';
import { getState } from './state';
import { signWithTemplateId } from './utils';
import { SignedData, TemplateId } from './validation/schema';

export type SignedResponse = [TemplateId, SignedData];

export type TemplateResponse = [TemplateId, node.HttpGatewayApiCallSuccessResponse];

export const signTemplateResponses = async (templateResponses: TemplateResponse[]) => {
  logger.debug('Signing template responses', { templateResponses });

  const signPromises = templateResponses.map(async ([templateId, response]) => {
    const encodedValue = response.data.encodedValue;
    const timestamp = Math.floor(Date.now() / 1000).toString();

    const wallet = ethers.Wallet.fromMnemonic(getState().config.airnodeWalletMnemonic);
    const goSignWithTemplateId = await go(() => signWithTemplateId(wallet, templateId, timestamp, encodedValue));
    if (!goSignWithTemplateId.success) {
      const message = `Failed to sign response. Error: "${goSignWithTemplateId.error}"`;
      logger.warn(message, {
        templateId,
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
