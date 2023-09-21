import { ethers } from 'ethers';

export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Generates a random ID used when creating Bottleneck limiters.
 */
export const getRandomId = () => ethers.utils.randomBytes(16).toString();

export const deriveEndpointId = (oisTitle: string, endpointName: string) =>
  ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string', 'string'], [oisTitle, endpointName]));

export const signWithTemplateId = (wallet: ethers.Wallet, templateId: string, timestamp: string, data: string) => {
  return wallet.signMessage(
    ethers.utils.arrayify(
      ethers.utils.keccak256(
        ethers.utils.solidityPack(['bytes32', 'uint256', 'bytes'], [templateId, timestamp, data || '0x'])
      )
    )
  );
};
