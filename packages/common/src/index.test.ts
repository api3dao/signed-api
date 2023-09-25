import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

it('index file re-exports from all implementation files', () => {
  const files = readdirSync(__dirname);
  const ignoreList = ['index.ts'];

  const implementationFiles = files.filter((file) => !file.endsWith('.test.ts') && !ignoreList.includes(file));
  const exports = [...readFileSync(join(__dirname, './index.ts'), 'utf8').matchAll(/export \* from/g)];

  expect(implementationFiles.length).toEqual(exports.length);
});
