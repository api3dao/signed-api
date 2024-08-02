import { deriveOevTemplateId, type SignedApiPayloadV1, type SignedApiPayloadV2 } from '@api3/airnode-feed';
import { ethers } from 'ethers';
import { omit } from 'lodash';

import type { InternalSignedData } from '../src/schema';
import { deriveBeaconId } from '../src/utils';

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

export const createSignedDataV1 = async (
  overrides?: Partial<Omit<SignedApiPayloadV1, 'airnode'> & { airnodeWallet: ethers.Wallet }>
) => {
  const signedData = await createInternalSignedData(overrides);
  return omit(signedData, 'isOevBeacon');
};

export const createSignedDataV2 = async (
  overrides?: Partial<Omit<SignedApiPayloadV2, 'airnode'> & { airnodeWallet: ethers.Wallet }>
) => {
  const signedData = await createInternalSignedData(overrides);
  const baseSignedData = omit(signedData, 'airnode', 'beaconId', 'isOevBeacon');
  const { templateId, timestamp, encodedValue } = signedData;

  const airnodeWallet = overrides?.airnodeWallet ?? ethers.Wallet.createRandom();
  const oevTemplateId = deriveOevTemplateId(templateId);
  const oevSignature =
    overrides?.oevSignature ?? (await generateDataSignature(airnodeWallet, oevTemplateId, timestamp, encodedValue));
  return { ...baseSignedData, oevSignature };
};

export const createInternalSignedData = async (
  overrides?: Partial<Omit<InternalSignedData, 'airnode'> & { airnodeWallet: ethers.Wallet }>
) => {
  const airnodeWallet = overrides?.airnodeWallet ?? ethers.Wallet.createRandom();

  const airnode = airnodeWallet.address;
  const templateId = overrides?.templateId ?? generateRandomBytes(32);
  const beaconId = overrides?.beaconId ?? deriveBeaconId(airnode, templateId);
  const timestamp = overrides?.timestamp ?? Math.floor(Date.now() / 1000).toString();
  const encodedValue = overrides?.encodedValue ?? '0x00000000000000000000000000000000000000000000005718e3a22ce01f7a40';
  const signature =
    overrides?.signature ?? (await generateDataSignature(airnodeWallet, templateId, timestamp, encodedValue));
  const isOevBeacon = overrides?.isOevBeacon ?? false;

  return {
    airnode,
    templateId,
    beaconId,
    timestamp,
    encodedValue,
    signature,
    isOevBeacon,
  };
};
