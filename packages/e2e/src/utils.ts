import { deriveBeaconId, type Hex } from '@api3/commons';
import { goSync } from '@api3/promise-utils';
import { ethers } from 'ethers';

export const formatData = (networkResponse: any) => {
  const goFormat = goSync(() =>
    Object.values(networkResponse.data).map((d: any) => {
      return {
        templateId: d.templateId,
        delay: Date.now() - d.timestamp * 1000,
        value: ethers.utils.defaultAbiCoder.decode(['int256'], d.encodedValue).toString(),
      };
    })
  );

  if (!goFormat.success) return networkResponse;
  return goFormat.data;
};

export const airnode = ethers.Wallet.fromMnemonic(
  'diamond result history offer forest diagram crop armed stumble orchard stage glance'
).address;

export const generateRandomBytes = (len: number) => ethers.utils.hexlify(ethers.utils.randomBytes(len));

export const generateRandomWallet = () => ethers.Wallet.createRandom();

export const generateRandomEvmAddress = () => generateRandomWallet().address;

// NOTE: This function (and related helpers) are copied over from signed-api project. Ideally, these would come from
// commons.
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
  airnodeWallet: ethers.Wallet,
  timestamp: string = Math.floor(Date.now() / 1000).toString()
) => {
  const airnode = airnodeWallet.address;
  const templateId = generateRandomBytes(32);
  const beaconId = deriveBeaconId(airnode as Hex, templateId as Hex);
  const encodedValue = '0x00000000000000000000000000000000000000000000005718e3a22ce01f7a40';
  const signature = await generateDataSignature(airnodeWallet, templateId, timestamp, encodedValue);

  return {
    airnode,
    templateId,
    beaconId,
    timestamp,
    encodedValue,
    signature,
  };
};
