import { goSync } from '@api3/promise-utils';
import workerpool from 'workerpool';

import type { SignedData } from './schema';
import { deriveBeaconId, recoverSignerAddress } from './utils';

interface VerificationError {
  message: string;
  detail?: string;
  signedData: SignedData;
}

export const verifySignedData = (batchSignedData: SignedData[]): VerificationError | null => {
  // Ensure the signed data is valid and timestamp does not drift too far into the future.
  for (const signedData of batchSignedData) {
    // The on-chain contract prevents time drift by making sure the timestamp is at most 1 hour in the future. System
    // time drift is less common, but we mirror the contract implementation.
    if (Number.parseInt(signedData.timestamp, 10) > Math.floor(Date.now() / 1000) + 60 * 60) {
      return { message: 'Request timestamp is too far in the future', signedData };
    }

    const goRecoverSigner = goSync(() => recoverSignerAddress(signedData));
    if (!goRecoverSigner.success) {
      return { message: 'Unable to recover signer address', detail: goRecoverSigner.error.message, signedData };
    }

    if (signedData.airnode !== goRecoverSigner.data) {
      return { message: 'Signature is invalid', signedData };
    }

    // We are deriving the beacon ID, because the signed data verification runs in a separate worker, which does not
    // have access to the in-memory cache of the main worker. When the V1 Airnode feeds are no longer used, this check
    // can be removed, because starting from V2, the beacon ID is not sent.
    const goDeriveBeaconId = goSync(() => deriveBeaconId(signedData.airnode, signedData.templateId));
    if (!goDeriveBeaconId.success) {
      return {
        message: 'Unable to derive beaconId by given airnode and templateId',
        detail: goDeriveBeaconId.error.message,
        signedData,
      };
    }

    if (signedData.beaconId !== goDeriveBeaconId.data) {
      return { message: 'beaconId is invalid', signedData };
    }
  }

  return null;
};

// Create a worker from this module and register public functions.
workerpool.worker({
  verifySignedData,
});
