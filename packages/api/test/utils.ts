import { ethers } from 'ethers';

import type { SignedData } from '../src/schema';

export const deriveBeaconId = (airnode: string, templateId: string) =>
  ethers.utils.keccak256(ethers.utils.solidityPack(['address', 'bytes32'], [airnode, templateId]));

export const deriveTemplateId = (endpointId: string, encodedParameters: string) =>
  ethers.utils.keccak256(ethers.utils.solidityPack(['bytes32', 'bytes'], [endpointId, encodedParameters]));

export const generateRandomBytes = (len: number) => ethers.utils.hexlify(ethers.utils.randomBytes(len));

export const generateRandomWallet = () => ethers.Wallet.createRandom();

export const generateRandomEvmAddress = () => generateRandomWallet().address;

export const generateDataSignature = async (
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

export const createSignedData = async (
  overrides?: Partial<Omit<SignedData, 'airnode'> & { airnodeWallet: ethers.Wallet }>
) => {
  const airnodeWallet = overrides?.airnodeWallet ?? ethers.Wallet.createRandom();

  const airnode = airnodeWallet.address;
  const templateId = overrides?.templateId ?? generateRandomBytes(32);
  const beaconId = overrides?.beaconId ?? deriveBeaconId(airnode, templateId);
  const timestamp = overrides?.timestamp ?? Math.floor(Date.now() / 1000).toString();
  const encodedValue = overrides?.encodedValue ?? '0x00000000000000000000000000000000000000000000005718e3a22ce01f7a40';
  const signature =
    overrides?.signature ?? (await generateDataSignature(airnodeWallet, templateId, timestamp, encodedValue));

  return {
    airnode,
    templateId,
    beaconId,
    timestamp,
    encodedValue,
    signature,
  };
};
