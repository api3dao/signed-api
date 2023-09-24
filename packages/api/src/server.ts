import express from 'express';
import { getData, listAirnodeAddresses, batchInsertData } from './handlers';
import { getConfig } from './utils';

export const startServer = () => {
  const config = getConfig();
  const app = express();

  app.use(express.json());

  app.post('/', async (req, res) => {
    // eslint-disable-next-line no-console
    console.log('Received request "POST /"', req.body, req.params, req.query);

    const result = await batchInsertData(req.body);
    res.status(result.statusCode).header(result.headers).send(result.body);
  });

  app.get('/', async (_req, res) => {
    // eslint-disable-next-line no-console
    console.log('Received request "GET /"');

    const result = await listAirnodeAddresses();
    res.status(result.statusCode).header(result.headers).send(result.body);
  });

  for (const endpoint of config.endpoints) {
    // eslint-disable-next-line no-console
    console.log('Registering endpoint', endpoint);
    const { urlPath, delaySeconds } = endpoint;

    app.get(`${urlPath}/:airnodeAddress`, async (req, res) => {
      // eslint-disable-next-line no-console
      console.log('Received request "GET /:airnode"', req.body, req.params, req.query);

      const result = await getData(req.params.airnodeAddress, delaySeconds);
      res.status(result.statusCode).header(result.headers).send(result.body);
    });
  }

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening at http://localhost:${config.port}`);
  });
};
