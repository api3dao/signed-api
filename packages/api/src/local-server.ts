import * as dotenv from 'dotenv';
import express from 'express';
import { getData, listAirnodeAddresses, batchUpsertData, upsertData } from './handlers';

dotenv.config();
const { PORT } = process.env;

const port = PORT;
const app = express();

app.use(express.json());

app.put('/', async (req, res) => {
  const result = await upsertData({
    body: JSON.stringify(req.body),
    queryParams: {},
  });
  res.status(result.statusCode).header(result.headers).send(result.body);
});

app.post('/', async (req, res) => {
  const result = await batchUpsertData({
    body: JSON.stringify(req.body),
    queryParams: {},
  });
  res.status(result.statusCode).header(result.headers).send(result.body);
});

app.get('/:airnode', async (req, res) => {
  const result = await getData({
    body: '',
    queryParams: { airnode: req.params.airnode },
  });
  res.status(result.statusCode).header(result.headers).send(result.body);
});

app.get('/', async (_req, res) => {
  const result = await listAirnodeAddresses({
    body: '',
    queryParams: {},
  });
  res.status(result.statusCode).header(result.headers).send(result.body);
});

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening at http://localhost:${port}`);
});

export default server;
