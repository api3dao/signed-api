import * as dotenv from 'dotenv';
import express from 'express';
import { getData, listAirnodeAddresses, batchUpsertData } from './handlers';

export const startServer = () => {
  dotenv.config();
  const { PORT } = process.env;

  const port = PORT;
  const app = express();

  app.use(express.json());

  app.post('/', async (req, res) => {
    // eslint-disable-next-line no-console
    console.log('Received request "POST /"', req.body, req.params, req.query);

    const result = await batchUpsertData({
      body: JSON.stringify(req.body),
      queryParams: {},
    });
    res.status(result.statusCode).header(result.headers).send(result.body);
  });

  app.get('/:airnode', async (req, res) => {
    // eslint-disable-next-line no-console
    console.log('Received request "GET /:airnode"', req.body, req.params, req.query);

    const result = await getData({
      body: '',
      queryParams: { airnode: req.params.airnode },
    });
    res.status(result.statusCode).header(result.headers).send(result.body);
  });

  app.get('/', async (_req, res) => {
    // eslint-disable-next-line no-console
    console.log('Received request "GET /"');

    const result = await listAirnodeAddresses({
      body: '',
      queryParams: {},
    });
    res.status(result.statusCode).header(result.headers).send(result.body);
  });

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening at http://localhost:${port}`);
  });
};
