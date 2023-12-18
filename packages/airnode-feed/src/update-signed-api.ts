import { pushSignedData } from './api-requests/signed-api';
import type { SignedApiUpdate } from './validation/schema';

export const schedulePushingSignedData = (signedApiUpdate: SignedApiUpdate) => {
  setTimeout(async () => pushSignedData(signedApiUpdate), signedApiUpdate.updateDelay);
};
