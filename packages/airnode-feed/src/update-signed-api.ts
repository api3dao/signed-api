import { pushSignedData } from './api-requests/signed-api';
import type { SignedResponse } from './sign-template-data';

export const schedulePushingSignedData = async (signedResponses: SignedResponse[]) => {
  await pushSignedData(signedResponses);
};
