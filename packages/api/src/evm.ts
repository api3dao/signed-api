import { ethers } from 'ethers';
import { SignedData } from './types';

export const decodeData = (data: string) => ethers.utils.defaultAbiCoder.decode(['int256'], data);

const packAndHashWithTemplateId = (templateId: string, timestamp: string, data: string) =>
  ethers.utils.arrayify(
    ethers.utils.keccak256(
      ethers.utils.solidityPack(['bytes32', 'uint256', 'bytes'], [templateId, timestamp, data || '0x'])
    )
  );

export const deriveBeaconId = (airnode: string, templateId: string) =>
  ethers.utils.keccak256(ethers.utils.solidityPack(['address', 'bytes32'], [airnode, templateId]));

export const signWithTemplateId = (airnodeWallet: ethers.Wallet, templateId: string, timestamp: string, data: string) =>
  airnodeWallet.signMessage(
    ethers.utils.arrayify(
      ethers.utils.keccak256(
        ethers.utils.solidityPack(['bytes32', 'uint256', 'bytes'], [templateId, timestamp, data || '0x'])
      )
    )
  );

export const recoverSignerAddress = (data: SignedData): string => {
  const digest = packAndHashWithTemplateId(data.templateId, data.timestamp, data.encodedValue);
  return ethers.utils.verifyMessage(digest, data.signature);
};
