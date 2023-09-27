import Bottleneck from 'bottleneck';
import { ethers } from 'ethers';
import { Config, SignedData, TemplateId } from './validation/schema';
import { OIS_MAX_CONCURRENCY_DEFAULT, OIS_MIN_TIME_DEFAULT_MS } from './constants';
import { deriveEndpointId, getRandomId } from './utils';

export type TemplateValueStorage = Record<TemplateId, DelayedSignedDataQueue>;

export interface State {
  config: Config;
  templateValues: TemplateValueStorage;
  // TODO: this can be trivially derived from config - remove.
  walletPrivateKey: string;
  apiLimiters: Record<string, Bottleneck | undefined>;
}

let state: State;

export const initializeState = (config: Config) => {
  state = getInitialState(config);
  return state;
};

export const buildApiLimiters = (config: Config) => {
  if (!config.ois) {
    return {};
  }

  const oisLimiters = Object.fromEntries(
    config.ois.map((ois) => {
      if (config.rateLimiting[ois.title]) {
        const { minTime, maxConcurrency } = config.rateLimiting[ois.title]!;

        return [
          ois.title,
          new Bottleneck({
            id: getRandomId(),
            minTime: minTime ?? OIS_MIN_TIME_DEFAULT_MS,
            maxConcurrent: maxConcurrency ?? OIS_MAX_CONCURRENCY_DEFAULT,
          }),
        ];
      }

      return [
        ois.title,
        new Bottleneck({
          id: getRandomId(),
          minTime: OIS_MIN_TIME_DEFAULT_MS,
          maxConcurrent: OIS_MAX_CONCURRENCY_DEFAULT,
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
      const title = endpointTitles[template.endpointId]!;
      return [templateId, oisLimiters[title]];
    })
  );

  return apiLimiters;
};

export const buildTemplateStorages = (config: Config) =>
  Object.fromEntries(Object.keys(config.templates).map((templateId) => [templateId, new DelayedSignedDataQueue()]));

export const getInitialState = (config: Config) => {
  return {
    config,
    templateValues: buildTemplateStorages(config),
    apiLimiters: buildApiLimiters(config),
    walletPrivateKey: ethers.Wallet.fromMnemonic(config.airnodeWalletMnemonic).privateKey,
    sponsorWalletsPrivateKey: {},
  };
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
