import cluster from 'node:cluster';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ethers } from 'ethers';
import prettier from 'prettier';

// The script creates a random mnemonic and writes it into airnode-feed.json configuration and starts an Airnode feed
// service which reads this configuration and sets the Signed API (as specified in the configuration). These Airnode
// feeds are started in parallel with a small delay to respect the source API and the host machine.
const main = async () => {
  if (cluster.isPrimary) {
    console.info(`Primary ${process.pid} is running`);

    if (!process.env.TOTAL_AIRNODE_FEEDS) throw new Error('TOTAL_AIRNODE_FEEDS is not set');
    const totalAirnodeFeeds = Number(process.env.TOTAL_AIRNODE_FEEDS!);

    // Fork workers for each Airnode feed.
    for (let i = 1; i <= totalAirnodeFeeds; i++) {
      const worker = cluster.fork({ SERVICE_DIR: i.toString() });

      // Separate the workers by 1 second so that there is a limited number of them running in parallel to avoid
      // draining the host machine and the target Signed API.
      await new Promise((resolve) => setTimeout(resolve, 1000));

      worker.on('online', () => {
        console.info(`Service in directory ${i} started with PID ${worker.process.pid}`);
      });

      worker.on('exit', (code, signal) => {
        console.info(`Service in directory ${i} stopped with exit code ${code} and signal ${signal}`);
      });
    }

    cluster.on('exit', (worker, code, signal) => {
      console.info(`Main process ${worker.process.pid} died with code: ${code}, and signal: ${signal}`);
    });

    return;
  }

  console.info(`Worker ${process.env.SERVICE_DIR} started`);

  // Change the working directory to the service directory.
  process.chdir(__dirname);

  // Change the Airnode feed mnemonic.
  const mnemonic = ethers.Wallet.createRandom().mnemonic.phrase;
  console.info(`Worker ${process.env.SERVICE_DIR} is using mnemonic: ${mnemonic}`);
  const configPath = join(__dirname, 'config/airnode-feed.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.nodeSettings.airnodeWalletMnemonic = mnemonic;
  const options = await prettier.resolveConfig(configPath);
  const formattedFile = await prettier.format(JSON.stringify(config, null, 2), { ...options, parser: 'json' });
  writeFileSync(configPath, formattedFile);

  // Start the Airnode feed service.
  require('../../../airnode-feed/dist/src/index.js');

  // Wait for 5 seconds for the service to push the signed data to Signed API.
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.info(`Worker ${process.env.SERVICE_DIR} finished`);

  // Kill the worker.
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(0);
};

void main();
