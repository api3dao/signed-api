import express from 'express';
import { getData, listAirnodeAddresses, batchInsertData } from './handlers';
import { logger } from './logger';
import { Config } from './schema';

export const startServer = (config: Config) => {
  const app = express();

  app.use(express.json());

  app.post('/', async (req, res) => {
    logger.info('Received request "POST /"', req.body);

    const result = await batchInsertData(req.body);
    res.status(result.statusCode).header(result.headers).send(result.body);

    logger.info('Responded to request "POST /"', result);
  });

  app.get('/', async (_req, res) => {
    logger.info('Received request "GET /"');

    const result = await listAirnodeAddresses();
    res.status(result.statusCode).header(result.headers).send(result.body);

    logger.info('Responded to request "GET /"', result);
  });

  for (const endpoint of config.endpoints) {
    logger.info('Registering endpoint', endpoint);
    const { urlPath, delaySeconds } = endpoint;

    app.get(`${urlPath}/:airnodeAddress`, async (req, res) => {
      logger.info('Received request "GET /:airnode"', { body: req.body, params: req.params });

      const result = await getData(req.params.airnodeAddress, delaySeconds);
      res.status(result.statusCode).header(result.headers).send(result.body);

      logger.info('Responded to request "GET /:airnode"', result);
    });
  }

  app.listen(config.port, () => {
    logger.info(`Server listening at http://localhost:${config.port}`);
  });
};
