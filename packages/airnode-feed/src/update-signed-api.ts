import { get, isEmpty, uniq } from 'lodash';

import { postSignedApiData } from './api-requests/signed-api';
import { SIGNED_DATA_PUSH_POLLING_INTERVAL } from './constants';
import { logger } from './logger';
import { getState } from './state';
import { sleep } from './utils';
import type { TemplateId } from './validation/schema';

// <Signed API Provider, <Update Delay, List of template IDs>>
type SignedApiUpdateDelayTemplateIdsMap = Record<string, Record<number, TemplateId[]>>;

export interface SignedApiNameUpdateDelayGroup {
  signedApiName: string;
  templateIds: TemplateId[];
  updateDelay: number;
}

export const initiateUpdatingSignedApi = () => {
  logger.debug('Initiating updating signed API.');
  const { config } = getState();

  const signedApiUpdateDelayTemplateIdsMap =
    config.triggers.signedApiUpdates.reduce<SignedApiUpdateDelayTemplateIdsMap>((acc, signedApiUpdate) => {
      if (isEmpty(signedApiUpdate.templateIds)) return acc;

      return {
        ...acc,
        [signedApiUpdate.signedApiName]: {
          ...acc[signedApiUpdate.signedApiName],
          [signedApiUpdate.updateDelay]: uniq([
            ...get(acc, [signedApiUpdate.signedApiName, signedApiUpdate.updateDelay], []),
            ...signedApiUpdate.templateIds,
          ]),
        },
      };
    }, {});

  const signedApiUpdateDelayGroups: SignedApiNameUpdateDelayGroup[] = Object.entries(
    signedApiUpdateDelayTemplateIdsMap
  ).flatMap(([signedApiName, updateDelayTemplateIds]) =>
    Object.entries(updateDelayTemplateIds).map(([updateDelay, templateIds]) => ({
      signedApiName,
      updateDelay: Number.parseInt(updateDelay, 10),
      templateIds,
    }))
  );

  signedApiUpdateDelayGroups.map(async (element) => updateSignedApiInLoop(element));
};

export const updateSignedApiInLoop = async (signedApiNameUpdateDelayGroup: SignedApiNameUpdateDelayGroup) => {
  while (true) {
    await postSignedApiData(signedApiNameUpdateDelayGroup);
    await sleep(SIGNED_DATA_PUSH_POLLING_INTERVAL);
  }
};
