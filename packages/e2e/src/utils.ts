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
