import { once } from 'node:events';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import express from 'express';

import { getMockedConfig } from '../test/fixtures';
import { generateRandomWallet } from '../test/utils';

import * as configModule from './config/config';
import { logger } from './logger';
import { startServer } from './server';

let server: http.Server;

beforeEach(async () => {
  jest.spyOn(configModule, 'getConfig').mockImplementation(getMockedConfig);
  const listenSpy = jest.spyOn(express.application, 'listen');
  startServer(getMockedConfig(), 0);
  server = listenSpy.mock.results[0]!.value;
  await once(server, 'listening');
});

afterEach(() => {
  server.close();
});

const sendRequest = async (method: string, path: string, body: unknown) => {
  const { port } = server.address() as AddressInfo;
  const data = JSON.stringify(body);
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
  const request = http.request({ port, method, path, headers });
  request.end(data);
  const [response] = (await once(request, 'response')) as [http.IncomingMessage];
  response.resume();
  return response;
};

describe(startServer.name, () => {
  it('does not log the body of a pushed batch', async () => {
    jest.spyOn(logger, 'debug');
    const airnode = generateRandomWallet().address;
    const body = [{}];

    const response = await sendRequest('POST', `/${airnode}`, body);

    expect(response.statusCode).toBe(400);
    expect(logger.debug).not.toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body }));
  });

  it('does not log the body of a request for signed data', async () => {
    jest.spyOn(logger, 'debug');
    const airnode = generateRandomWallet().address;
    const body = [{}];

    const response = await sendRequest('GET', `/delayed/${airnode}`, body);

    expect(response.statusCode).toBe(200);
    expect(logger.debug).not.toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body }));
  });

  it('does not log the body of a request that fails to parse', async () => {
    jest.spyOn(logger, 'error');
    const airnode = generateRandomWallet().address;
    const body = 'signed data';

    const response = await sendRequest('POST', `/${airnode}`, body);

    expect(response.statusCode).toBe(400);
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ err: expect.objectContaining({ body: JSON.stringify(body) }) })
    );
  });
});
