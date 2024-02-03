import workerpool, { type Pool } from 'workerpool';

// Create a worker pool using an external worker script.
let pool: Pool | undefined;

export const initializeVerifierPool = () => {
  // Allow using the worker from TS (run in development mode) or JS files (when compiled). Note, that transpiling the
  // file in development mode is done by ts-node and so it must be available.
  const extension = __filename.endsWith('.ts') ? 'ts' : 'js';
  // Allow using the worker as a TypeScript module. See:
  // https://github.com/josdejong/workerpool/issues/379#issuecomment-1580093502.
  //
  // Note, that the pool default settings are well set, so we are leaving that as is.
  const options =
    extension === 'ts'
      ? {
          workerThreadOpts: {
            execArgv: ['--require', 'ts-node/register'],
          },
        }
      : {};
  pool = workerpool.pool(`${__dirname}/signed-data-verifier.${extension}`, options);

  return pool;
};

export const getVerifier = async () => {
  if (!pool) throw new Error('Worker pool has not been initialized');

  return pool.proxy<typeof import('./signed-data-verifier')>();
};
