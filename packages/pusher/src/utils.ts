import { ethers } from 'ethers';

export const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const deriveEndpointId = (oisTitle: string, endpointName: string) =>
  ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string', 'string'], [oisTitle, endpointName]));

export const signWithTemplateId = async (
  wallet: ethers.Wallet,
  templateId: string,
  timestamp: string,
  data: string
) => {
  return wallet.signMessage(
    ethers.utils.arrayify(
      ethers.utils.keccak256(
        ethers.utils.solidityPack(['bytes32', 'uint256', 'bytes'], [templateId, timestamp, data || '0x'])
      )
    )
  );
};
