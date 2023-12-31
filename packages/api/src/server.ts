import express from 'express';

import { getData, listAirnodeAddresses, batchInsertData } from './handlers';
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

  app.post('/', async (req, res) => {
    logger.info('Received request "POST /".');
    logger.debug('Request details.', { body: req.body });

    const result = await batchInsertData(req.headers.authorization, req.body);
    res.status(result.statusCode).header(result.headers).send(result.body);

    logger.debug('Responded to request "POST /".', result);
  });

  app.get('/', async (_req, res) => {
    logger.info('Received request "GET /".');

    const result = await listAirnodeAddresses();
    res.status(result.statusCode).header(result.headers).send(result.body);

    logger.debug('Responded to request "GET /".', result);
  });

  for (const endpoint of config.endpoints) {
    logger.info('Registering endpoint.', endpoint);
    const { urlPath } = endpoint;

    app.get(`${urlPath}/:airnodeAddress`, async (req, res) => {
      logger.info(`Received request "GET ${urlPath}/:airnode".`);
      logger.debug('Request details.', { body: req.body, params: req.params });

      const result = await getData(endpoint, req.headers.authorization, req.params.airnodeAddress);
      res.status(result.statusCode).header(result.headers).send(result.body);

      logger.debug('Responded to request "GET /:airnode".', result);
    });
  }

  // Inline error handling middleware
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('An unexpected error occurred.', { err });

    res.status(err.status || 500).json({
      error: {
        message: err.message || 'An unexpected error occurred.',
      },
    });
  });

  app.listen(port, () => {
    logger.info(`Server listening at http://localhost:${port}.`);
  });
};
