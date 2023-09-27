import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

it('index file re-exports from all implementation folders', () => {
  const entries = readdirSync(__dirname, { withFileTypes: true });

  const subFolders = entries.filter((entry) => entry.isDirectory()).map((dir) => dir.name);
  const mainExports = [
    ...readFileSync(join(__dirname, './index.ts'), 'utf8').matchAll(/export \* from '\.\/(.+)'/g),
  ].map((match) => match[1]);

  expect(subFolders).toEqual(mainExports);
});
