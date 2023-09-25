import express from 'express';
import { getData, listAirnodeAddresses, batchInsertData } from './handlers';
import { getConfig } from './utils';
import { getLogger } from './logger';

export const startServer = () => {
  const config = getConfig();
  const app = express();

  app.use(express.json());

  app.post('/', async (req, res) => {
    getLogger().info('Received request "POST /"', req.body);

    const result = await batchInsertData(req.body);
    res.status(result.statusCode).header(result.headers).send(result.body);
  });

  app.get('/', async (_req, res) => {
    getLogger().info('Received request "GET /"');

    const result = await listAirnodeAddresses();
    res.status(result.statusCode).header(result.headers).send(result.body);
  });

  for (const endpoint of config.endpoints) {
    getLogger().info('Registering endpoint', endpoint);
    const { urlPath, delaySeconds } = endpoint;

    app.get(`${urlPath}/:airnodeAddress`, async (req, res) => {
      getLogger().info('Received request "GET /:airnode"', { body: req.body, params: req.params });

      const result = await getData(req.params.airnodeAddress, delaySeconds);
      res.status(result.statusCode).header(result.headers).send(result.body);
    });
  }

  app.listen(config.port, () => {
    getLogger().info(`Server listening at http://localhost:${config.port}`);
  });
};
