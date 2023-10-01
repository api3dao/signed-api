import { get, isEmpty } from 'lodash';
import { logger } from './logger';
import { getState } from './state';
import { sleep } from './utils';
import { BeaconId } from './validation/schema';
import { NO_SIGNED_API_UPDATE_EXIT_CODE, SIGNED_DATA_PUSH_POLLING_INTERVAL } from './constants';
import { postSignedApiData } from './api-requests/signed-api';

// <Signed API Provider, <Update Delay, List of Beacon ID>>
type SignedApiUpdateDelayBeaconIdsMap = Record<string, Record<number, BeaconId[]>>;

export type SignedApiNameUpdateDelayGroup = {
  signedApiName: string;
  beaconIds: BeaconId[];
  updateDelay: number;
};

export const initiateUpdatingSignedApi = async () => {
  logger.debug('Initiating updating signed API');
  const { config } = getState();

  const signedApiUpdateDelayBeaconIdsMap = config.triggers.signedApiUpdates.reduce(
    (acc: SignedApiUpdateDelayBeaconIdsMap, signedApiUpdate) => {
      if (isEmpty(signedApiUpdate.beaconIds)) return acc;
      return {
        ...acc,
        [signedApiUpdate.signedApiName]: {
          ...acc[signedApiUpdate.signedApiName],
          [signedApiUpdate.updateDelay]: [
            ...get(acc, [signedApiUpdate.signedApiName, signedApiUpdate.updateDelay], []),
            ...signedApiUpdate.beaconIds,
          ],
        },
      };
    },
    {}
  );

  const signedApiUpdateDelayGroups: SignedApiNameUpdateDelayGroup[] = Object.entries(
    signedApiUpdateDelayBeaconIdsMap
  ).flatMap(([signedApiName, updateDelayBeaconIds]) =>
    Object.entries(updateDelayBeaconIds).map(([updateDelay, beaconIds]) => ({
      signedApiName,
      updateDelay: parseInt(updateDelay),
      beaconIds,
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
