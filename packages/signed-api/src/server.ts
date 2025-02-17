import { go } from '@api3/promise-utils';
import express from 'express';

import { getData, getStatus, listAirnodeAddresses, batchInsertData } from './handlers';
import { logger } from './logger';
import type { Config } from './schema';

// The port number is defaulted to 80 because the service is dockerized and users can re-publish the container to any
// port they want. The CloudFormation template needs to know what is the container port so we hardcode it to 80. We
// still want the port to be configurable when running the signed API in development (by running it with node).
export const DEFAULT_PORT = 80;

export const startServer = (config: Config, port: number) => {
  const app = express();

  // The default limit is 100kb, which is not enough for the signed API because some payloads can be quite large.
  app.use(express.json({ limit: '10mb' }));

  app.post('/:airnodeAddress', async (req, res, next) => {
    const goRequest = await go(async () => {
      logger.info('Received request "POST /:airnodeAddress".');
      logger.debug('Request details.', { body: req.body, params: req.params });

      const result = await batchInsertData(req.headers.authorization, req.body, req.params.airnodeAddress);
      res.status(result.statusCode).header(result.headers).send(result.body);

      logger.debug('Responded to request "POST /".', result);
    });

    if (!goRequest.success) next(goRequest.error);
  });

  app.get('/', async (_req, res, next) => {
    const goRequest = await go(async () => {
      logger.info('Received request "GET /".');

      const result = await listAirnodeAddresses();
      res.status(result.statusCode).header(result.headers).send(result.body);

      logger.debug('Responded to request "GET /".', result);
    });

    if (!goRequest.success) next(goRequest.error);
  });

  app.get('/status', async (_req, res, next) => {
    const goRequest = await go(() => {
      logger.info('Received request "GET /status".');

      const result = getStatus();
      res.status(result.statusCode).header(result.headers).send(result.body);

      logger.debug('Responded to request "GET /status".', result);
    });

    if (!goRequest.success) next(goRequest.error);
  });

  for (const endpoint of config.endpoints) {
    logger.info('Registering endpoint.', endpoint);
    const { urlPath } = endpoint;

    app.get(`${urlPath}/:airnodeAddress`, async (req, res, next) => {
      const goRequest = await go(() => {
        logger.info(`Received request "GET ${urlPath}/:airnodeAddress".`);
        logger.debug('Request details.', { body: req.body, params: req.params });

        const result = getData(endpoint, req.headers.authorization, req.params.airnodeAddress);
        res.status(result.statusCode).header(result.headers).send(result.body);

        logger.debug('Responded to request "GET /:airnodeAddress".', result);
      });

      if (!goRequest.success) next(goRequest.error);
    });
  }

  // NOTE: The error handling middleware only catches synchronous errors. Request handlers logic should be wrapped in
  // try-catch and manually passed to next() in case of errors.
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // For unhandled errors it's very beneficial to have the stack trace. It is possible that the value is not an error.
    // It would be nice to know the stack trace in such cases as well.
    const stack = err.stack ?? new Error('Unexpected non-error value encountered').stack;
    logger.error('An unexpected handler error occurred.', { err, stack });

    res.status(err.status || 500).json({
      error: {
        message: err.message || 'An unexpected handler error occurred.',
      },
    });
  });

  app.listen(port, () => {
    logger.info(`Server listening at http://localhost:${port}.`);
  });
};
