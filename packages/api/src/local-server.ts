import * as dotenv from 'dotenv'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config();
import express from 'express';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { getData, listAirnodeAddresses, batchUpsertData, upsertData } from './handlers';

const { PORT } = process.env;

const port = PORT || 8090;
const app = express();

app.put('/', express.json(), async (req, res) => {
  const result = await upsertData({
    body: JSON.stringify(req.body),
  } as APIGatewayProxyEvent);
  res.status(result.statusCode).header(result.headers).send(result.body);
});

app.post('/', express.json(), async (req, res) => {
  const result = await batchUpsertData({
    body: JSON.stringify(req.body),
  } as APIGatewayProxyEvent);
  res.status(result.statusCode).header(result.headers).send(result.body);
});

app.get('/:airnode', async (req, res) => {
  const result = await getData({
    pathParameters: { airnode: req.params.airnode } as unknown,
  } as APIGatewayProxyEvent);
  res.status(result.statusCode).header(result.headers).send(result.body);
});

app.get('/', async (req, res) => {
  const result = await listAirnodeAddresses({} as APIGatewayProxyEvent);
  res.status(result.statusCode).header(result.headers).send(result.body);
});

const server = app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

export default server;
