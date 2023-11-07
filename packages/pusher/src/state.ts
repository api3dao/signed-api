import { ethers } from 'ethers';
import { last } from 'lodash';

import type { Config, SignedData, TemplateId } from './validation/schema';

export type TemplateValueStorage = Record<TemplateId, DelayedSignedDataQueue>;

export interface State {
  config: Config;
  templateValues: TemplateValueStorage;
  // We persist the derived Airnode wallet in memory as a performance optimization.
  airnodeWallet: ethers.Wallet;
  // The timestamp of when the service was initialized. This can be treated as a "deployment" timestamp.
  deploymentTimestamp: string;
}

let state: State;

export const initializeState = (config: Config) => {
  state = getInitialState(config);
  return state;
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
    airnodeWallet: ethers.Wallet.fromMnemonic(config.nodeSettings.airnodeWalletMnemonic),
    deploymentTimestamp: Math.floor(Date.now() / 1000).toString(),
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
// eslint-disable-next-line functional/no-classes
export class DelayedSignedDataQueue {
  private storage: SignedData[] = [];

  private readonly maxUpdateDelay: number;

  /**
   * Creates the delayed signed data queue with the maximum update delay time. If there exists some signed data satisfying
   * this delay, all other signed data with smaller timestamps are removed.
   * @param maxUpdateDelay - The maximum update delay time in seconds.
   */
  public constructor(maxUpdateDelay: number) {
    this.maxUpdateDelay = maxUpdateDelay;
  }

  /**
   * Checks if a signed data entry is delayed enough. This means that the timestamp of the entry must be smaller than
   * the reference timestamp.
   */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  private isDelayedEnough(data: SignedData, referenceTimestamp: number) {
    return Number.parseInt(data.timestamp, 10) < referenceTimestamp;
  }

  /**
   * Adds a signed data entry to the queue. Assumes the data is not older than other entries in the queue.
   * @param data - The signed data entry to add.
   */
  public put(data: SignedData): void {
    // Make sure the data is not older than other entries in the queue.
    if (
      this.storage.length > 0 &&
      Number.parseInt(last(this.storage)!.timestamp, 10) > Number.parseInt(data.timestamp, 10)
    ) {
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

    if (index === -1) return;
    this.storage = this.storage.slice(index);
  }

  public getAll(): SignedData[] {
    return this.storage;
  }
}
