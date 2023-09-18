import { ethers } from 'ethers';

export const SIGNED_DATA_PUSH_POLLING_INTERVAL = 2_500;

export const DIRECT_GATEWAY_TIMEOUT_MS = 10_000;
export const RANDOM_BACKOFF_MIN_MS = 0;
export const RANDOM_BACKOFF_MAX_MS = 2_500;
// The minimum amount of time between HTTP calls to remote APIs per OIS.
export const DIRECT_GATEWAY_MIN_TIME_DEFAULT_MS = 20;
// The maximum number of simultaneously-running HTTP requests to remote APIs per OIS.
export const DIRECT_GATEWAY_MAX_CONCURRENCY_DEFAULT = 10;

// Solidity type(int224).min
export const INT224_MIN = ethers.BigNumber.from(2).pow(ethers.BigNumber.from(223)).mul(ethers.BigNumber.from(-1));
// Solidity type(int224).max
export const INT224_MAX = ethers.BigNumber.from(2).pow(ethers.BigNumber.from(223)).sub(ethers.BigNumber.from(1));
// Number that represents 100% is chosen to avoid overflows in DapiServer's
// `calculateUpdateInPercentage()`. Since the reported data needs to fit
// into 224 bits, its multiplication by 10^8 is guaranteed not to overflow.
export const HUNDRED_PERCENT = 1e8;

export const NO_SIGNED_API_UPDATE_EXIT_CODE = 1;
export const NO_FETCH_EXIT_CODE = 2;
