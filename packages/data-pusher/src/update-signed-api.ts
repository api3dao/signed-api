import { get, isEmpty } from 'lodash';
import { logger } from './logger';
import { getState } from './state';
import { sleep } from './utils';
import { TemplateId } from './validation/schema';
import { NO_SIGNED_API_UPDATE_EXIT_CODE, SIGNED_DATA_PUSH_POLLING_INTERVAL } from './constants';
import { postSignedApiData } from './api-requests/signed-api';

// <Signed API Provider, <Update Delay, List of template IDs>>
type SignedApiUpdateDelayTemplateIdsMap = Record<string, Record<number, TemplateId[]>>;

export type SignedApiNameUpdateDelayGroup = {
  signedApiName: string;
  templateIds: TemplateId[];
  updateDelay: number;
};

export const initiateUpdatingSignedApi = async () => {
  logger.debug('Initiating updating signed API');
  const { config } = getState();

  const signedApiUpdateDelayTemplateIdsMap = config.triggers.signedApiUpdates.reduce(
    (acc: SignedApiUpdateDelayTemplateIdsMap, signedApiUpdate) => {
      if (isEmpty(signedApiUpdate.templateIds)) return acc;
      return {
        ...acc,
        [signedApiUpdate.signedApiName]: {
          ...acc[signedApiUpdate.signedApiName],
          [signedApiUpdate.updateDelay]: [
            ...get(acc, [signedApiUpdate.signedApiName, signedApiUpdate.updateDelay], []),
            ...signedApiUpdate.templateIds,
          ],
        },
      };
    },
    {}
  );

  const signedApiUpdateDelayGroups: SignedApiNameUpdateDelayGroup[] = Object.entries(
    signedApiUpdateDelayTemplateIdsMap
  ).flatMap(([signedApiName, updateDelayTemplateIds]) =>
    Object.entries(updateDelayTemplateIds).map(([updateDelay, templateIds]) => ({
      signedApiName,
      updateDelay: parseInt(updateDelay),
      templateIds,
    }))
  );

  if (isEmpty(signedApiUpdateDelayGroups)) {
    logger.error('No signed API updates found. Stopping.');
    process.exit(NO_SIGNED_API_UPDATE_EXIT_CODE);
  }

  return signedApiUpdateDelayGroups.map(updateSignedApiInLoop);
};

export const updateSignedApiInLoop = async (signedApiNameUpdateDelayGroup: SignedApiNameUpdateDelayGroup) => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await postSignedApiData(signedApiNameUpdateDelayGroup);
    await sleep(SIGNED_DATA_PUSH_POLLING_INTERVAL);
  }
};
