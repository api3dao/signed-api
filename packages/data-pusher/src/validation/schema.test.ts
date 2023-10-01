import { readFileSync } from 'fs';
import { join } from 'path';
import { ZodError } from 'zod';
import { configSchema, signedApisSchema } from './schema';

it('validates example config', async () => {
  const config = JSON.parse(readFileSync(join(__dirname, '../../config/pusher.example.json'), 'utf8'));

  await expect(configSchema.parseAsync(config)).resolves.toEqual(expect.any(Object));
});

it('ensures signed API names are unique', () => {
  expect(() =>
    signedApisSchema.parse([
      { name: 'foo', url: 'https://example.com' },
      { name: 'foo', url: 'https://example.com' },
    ])
  ).toThrow(
    new ZodError([
      {
        code: 'custom',
        message: 'Signed API names must be unique',
        path: ['signedApis'],
      },
    ])
  );

  expect(signedApisSchema.parse([{ name: 'foo', url: 'https://example.com' }])).toEqual([
    {
      name: 'foo',
      url: 'https://example.com',
    },
  ]);
});
