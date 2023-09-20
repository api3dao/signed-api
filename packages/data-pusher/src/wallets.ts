import { ethers } from 'ethers';
import { getState, updateState } from './state';

export const initializeWallet = () => {
  const { config } = getState();

  const walletPrivateKey = ethers.Wallet.fromMnemonic(config.walletMnemonic).privateKey;

  updateState((state) => ({ ...state, walletPrivateKey }));
};
