import Bottleneck from 'bottleneck';
import { last } from 'lodash';
import { Config, SignedData, TemplateId } from './validation/schema';
import { OIS_MAX_CONCURRENCY_DEFAULT, OIS_MIN_TIME_DEFAULT_MS } from './constants';
import { deriveEndpointId, getRandomId } from './utils';

export type TemplateValueStorage = Record<TemplateId, DelayedSignedDataQueue>;

export interface State {
  config: Config;
  templateValues: TemplateValueStorage;
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

export const buildTemplateStorages = (config: Config) => {
  return Object.fromEntries(
    Object.keys(config.templates).map((templateId) => {
      const maxUpdateDelayTime = Math.max(...Object.values(config.triggers.signedApiUpdates).map((u) => u.updateDelay));
      return [templateId, new DelayedSignedDataQueue(maxUpdateDelayTime)];
    })
  );
};

export const getInitialState = (config: Config): State => {
  return {
    config,
    templateValues: buildTemplateStorages(config),
    apiLimiters: buildApiLimiters(config),
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
  private maxUpdateDelay: number;

  /**
   * Creates the delayed signed data queue with the maximum update delay time. If there exists some signed data satisfying
   * this delay, all other signed data with smaller timestamps are removed.
   * @param maxUpdateDelay - The maximum update delay time in seconds.
   */
  constructor(maxUpdateDelay: number) {
    this.maxUpdateDelay = maxUpdateDelay;
  }

  /**
   * Checks if a signed data entry is delayed enough. This means that the timestamp of the entry must be smaller than
   * the reference timestamp.
   */
  private isDelayedEnough(data: SignedData, referenceTimestamp: number) {
    return parseInt(data.timestamp) < referenceTimestamp;
  }

  /**
   * Adds a signed data entry to the queue. Assumes the data is not older than other entries in the queue.
   * @param data - The signed data entry to add.
   */
  public put(data: SignedData): void {
    // Make sure the data is not older than other entries in the queue.
    if (this.storage.length && parseInt(last(this.storage)!.timestamp) > parseInt(data.timestamp)) {
      throw new Error('The signed data is too old');
    }
    this.storage.push(data);
  }
  /**
   * Retrieves the newest signed data entry from the queue that is delayed by a specified time.
   * @param referenceTimestamp - The reference timestamp in seconds. Signed data with newer or equal timestamp is
   * ignored during this call.
   * @returns The delayed signed data entry, or undefined if none is found.
   */
  public get(referenceTimestamp: number): SignedData | undefined {
    // Find the newest delayed data entry in the storage.
    return this.storage.findLast((data) => this.isDelayedEnough(data, referenceTimestamp));
  }

  /**
   * Removes all signed data entries from the queue that are not needed anymore. This means that there must exist a
   * signed data with timestamp smaller maximum update delay. All data with smaller timestamp can be removed.
   */
  public prune(): void {
    const index = this.storage.findLastIndex((data) =>
      this.isDelayedEnough(data, Date.now() / 1000 - this.maxUpdateDelay)
    );

    this.storage = this.storage.slice(index);
  }

  public getAll(): SignedData[] {
    return this.storage;
  }
}