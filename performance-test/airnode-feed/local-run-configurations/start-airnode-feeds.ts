import cluster from 'node:cluster';
import path from 'node:path';

const totalServices = 15; // NOTE: Running more than 15 services on my machine causes request failures.

if (cluster.isPrimary) {
  console.info(`Primary ${process.pid} is running`);

  // Fork workers.
  for (let i = 1; i <= totalServices; i++) {
    const worker = cluster.fork({ SERVICE_DIR: i.toString() });

    worker.on('online', () => {
      console.info(`Service in directory ${i} started with PID ${worker.process.pid}`);
    });

    worker.on('exit', (code, signal) => {
      console.info(`Service in directory ${i} stopped with exit code ${code} and signal ${signal}`);
    });
  }

  cluster.on('exit', (worker, code, signal) => {
    console.info(`Worker ${worker.process.pid} died with code: ${code}, and signal: ${signal}`);
  });
} else {
  console.info(`Worker ${process.env.SERVICE_DIR} started`);

  // Change working directory
  process.chdir(path.join(__dirname, process.env.SERVICE_DIR!));

  // Start the Node.js service here
  require('../../../packages/airnode-feed/dist/src/index.js');
}
