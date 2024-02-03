import workerpool, { type Pool } from 'workerpool';

// Create a worker pool using an external worker script.
let pool: Pool | undefined;

export const initializeVerifierPool = () => {
  pool = workerpool.pool(`${__dirname}/signed-data-verifier.ts`, {
    // Allow using the worker as a TypeScript module. See:
    // https://github.com/josdejong/workerpool/issues/379#issuecomment-1580093502.
    //
    // Note, that the pool default settings are well set, so we are leaving that as is.
    workerType: 'thread',
    workerThreadOpts: {
      // TODO: Will need to bundle ts-node
      execArgv: ['--require', 'ts-node/register'],
    },
  });

  return pool;
};

export const getVerifier = async () => {
  if (!pool) throw new Error('Worker pool has not been initialized');

  return pool.proxy<typeof import('./signed-data-verifier')>();
};
