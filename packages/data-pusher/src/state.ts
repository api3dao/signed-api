import { setLogOptions, randomHexString } from '@api3/airnode-utilities';
import { ethers, utils } from 'ethers';
import Bottleneck from 'bottleneck';
import { uniqBy } from 'lodash';
import { Config, SignedData, TemplateId } from './validation';
import { DIRECT_GATEWAY_MAX_CONCURRENCY_DEFAULT, DIRECT_GATEWAY_MIN_TIME_DEFAULT_MS } from './constants';
import { logger } from './logging';

export type Id<T> = T & {
  id: string;
};

export type Index<T> = T & {
  index: number;
};

export type TemplateValueStorage = Record<TemplateId, DelayedSignedDataQueue>;

export interface State {
  config: Config;
  stopSignalReceived: boolean;
  templateValues: TemplateValueStorage;
  airseekerWalletPrivateKey: string;
  apiLimiters: Record<string, Bottleneck>;
}

// TODO: Freeze the state in development mode
let state: State;

export const initializeState = (config: Config) => {
  state = getInitialState(config);
};

/**
 * Generates a random ID used when creating Bottleneck limiters.
 */
// eslint-disable-next-line functional/prefer-tacit
export const getRandomId = () => utils.randomBytes(16).toString();

const deriveEndpointId = (oisTitle: string, endpointName: string) =>
  ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string', 'string'], [oisTitle, endpointName]));

export const buildApiLimiters = (config: Config) => {
  if (!config.ois) {
    return {};
  }

  const oisLimiters = Object.fromEntries(
    config.ois.map((ois) => {
      const directGatewayOverrides = config?.rateLimiting?.overrides?.directGateways;

      if (directGatewayOverrides && directGatewayOverrides[ois.title]) {
        const { minTime, maxConcurrent } = directGatewayOverrides[ois.title];

        return [
          ois.title,
          new Bottleneck({
            id: getRandomId(),
            minTime: minTime ?? DIRECT_GATEWAY_MIN_TIME_DEFAULT_MS,
            maxConcurrent: maxConcurrent ?? DIRECT_GATEWAY_MAX_CONCURRENCY_DEFAULT,
          }),
        ];
      }

      return [
        ois.title,
        new Bottleneck({
          id: getRandomId(),
          minTime: DIRECT_GATEWAY_MIN_TIME_DEFAULT_MS,
          maxConcurrent: DIRECT_GATEWAY_MAX_CONCURRENCY_DEFAULT,
        }),
      ];
    })
  );
  const endpointTitles = Object.fromEntries(
    config.ois.flatMap((ois) =>
      ois.endpoints.map((endpoint) => [deriveEndpointId(ois.title, endpoint.name), ois.title])
    )
  );

  // Make use of the reference/pointer nature of objects
  const apiLimiters = Object.fromEntries(
    Object.entries(config.templates).map(([templateId, template]) => {
      const title = endpointTitles[template.endpointId];
      return [templateId, oisLimiters[title]];
    })
  );

  return apiLimiters;
};

export const buildTemplateStorages = (config: Config) =>
  Object.fromEntries(Object.keys(config.templates).map((templateId) => [templateId, new DelayedSignedDataQueue()]));

export const getInitialState = (config: Config) => {
  // Set initial log options
  setLogOptions({
    ...config.log,
    meta: { 'Coordinator-ID': randomHexString(16) },
  });

  return {
    config,
    stopSignalReceived: false,
    templateValues: buildTemplateStorages(config),
    providers: {},
    apiLimiters: buildApiLimiters(config),
    airseekerWalletPrivateKey: '',
    sponsorWalletsPrivateKey: {},
  };
};

type StateUpdater = (state: State) => State;
export const updateState = (updater: StateUpdater) => {
  setState(updater(state));
};

export const expireLimiterJobs = async () => {
  // Trying to stop already stopping limiters produces very nasty errors.
  if (getState().stopSignalReceived) {
    return;
  }

  logger.warn('Terminating all limiters...');

  const limiterStopper = (limiter?: Bottleneck) => {
    const stopOptions = { dropWaitingJobs: true };

    return limiter?.stop(stopOptions);
  };

  const state = getState();

  // Limiters should not be stopped multiple times - so we uniq them by their random IDs.
  const apiLimiterPromises = uniqBy(Object.values(state.apiLimiters), (item) => item.id).map(limiterStopper);

  await Promise.allSettled([...apiLimiterPromises]);
};

export const setState = (newState: State) => {
  state = newState;
};

export const getState = () => {
  return state;
};

/**
 * Represents a queue-like data structure for managing and retrieving delayed signed data entries.
 */
export class DelayedSignedDataQueue {
  private storage: SignedData[] = [];

  public put(data: SignedData): void {
    this.storage.push(data);
  }
  /**
   * Retrieves the newest signed data entry from the queue that is delayed by a specified time.
   * @param updateDelay - The maximum delay (in seconds) allowed for retrieved data.
   * @returns The delayed signed data entry, or undefined if none is found.
   */
  public get(updateDelay: number): SignedData | undefined {
    // Calculate the reference timestamp based on the current time and update delay.
    const referenceTimestamp = Date.now() / 1000 - updateDelay;
    // Function to check if an element's timestamp is delayed enough.
    const isDelayedEnough = (element: SignedData) => parseInt(element.timestamp) < referenceTimestamp;
    // Find the index of the newest delayed data entry in the storage.
    const index = this.storage.findLastIndex(isDelayedEnough);
    // If a delayed entry is found, remove older entries (also include returned one) and return the delayed one.
    if (index >= 0) {
      const delayedData = this.storage[index];
      this.storage.splice(0, index + 1);
      return delayedData;
    }

    return;
  }

  public list(): SignedData[] {
    return this.storage;
  }
}
