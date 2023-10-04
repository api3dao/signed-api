import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

test('index file re-exports from all implementation folders', () => {
  const entries = readdirSync(__dirname, { withFileTypes: true });

  const subFolders = entries.filter((entry) => entry.isDirectory()).map((dir) => dir.name);
  const mainExports = [
    ...readFileSync(join(__dirname, './index.ts'), 'utf8').matchAll(/export \* from '\.\/(.+)'/g),
  ].map((match) => match[1]);

  expect(subFolders).toStrictEqual(mainExports);
});
