import { ethers } from 'ethers';
import { getState, updateState } from './state';

export const initializeAirseekerWallet = () => {
  const { config } = getState();

  // Derive airseeker wallet
  const airseekerWalletPrivateKey = ethers.Wallet.fromMnemonic(config.airseekerWalletMnemonic).privateKey;

  updateState((state) => ({ ...state, airseekerWalletPrivateKey }));
};
