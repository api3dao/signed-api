import { ethers } from 'ethers';
import { getState, setState } from './state';

export const initializeWallet = () => {
  const state = getState();

  const walletPrivateKey = ethers.Wallet.fromMnemonic(state.config.walletMnemonic).privateKey;

  setState({ ...state, walletPrivateKey });
};
