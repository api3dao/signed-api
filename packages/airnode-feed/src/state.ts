import { ethers } from 'ethers';

import type { Config } from './validation/schema';

export interface State {
  config: Config;
  // We persist the derived Airnode wallet in memory as a performance optimization.
  airnodeWallet: ethers.Wallet;
  // The timestamp of when the service was initialized. This can be treated as a "deployment" timestamp.
  deploymentTimestamp: string;
  // Mapping for template ID to their OEV counterparts. The OEV template ID is hashed from the original template ID and
  // is cached for performance reasons.
  templateIdToOevTemplateId: Record<string, string>;
}

let state: State;

export const initializeState = (config: Config) => {
  state = getInitialState(config);
  return state;
};

export const getInitialState = (config: Config): State => {
  return {
    config,
    airnodeWallet: ethers.Wallet.fromMnemonic(config.nodeSettings.airnodeWalletMnemonic),
    deploymentTimestamp: Math.floor(Date.now() / 1000).toString(),
    templateIdToOevTemplateId: {},
  };
};

export const setState = (newState: State) => {
  state = newState;
};

export const getState = () => {
  return state;
};
