import { executeRequest } from '@api3/commons';

import { logger } from './logger';
import { airnode, formatData } from './utils';

const main = async () => {
  while (true) {
    logger.debug('Making requests');

    const realTimeResponse = await executeRequest({
      method: 'get',
      url: `http://localhost:8090/real-time/${airnode}`,
      headers: { Authorization: `Bearer some-secret-token` },
    });
    logger.debug('Response "GET /real-time".', formatData(realTimeResponse.data));

    const delayedResponse = await executeRequest({ method: 'get', url: `http://localhost:8090/delayed/${airnode}` });
    logger.debug('Response "GET /delayed".', formatData(delayedResponse.data));

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

void main();
