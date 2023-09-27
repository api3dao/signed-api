import { readFileSync } from 'fs';
import { join } from 'path';
import { configSchema } from './schema';

it('validates example config', async () => {
  const config = JSON.parse(readFileSync(join(__dirname, '../../config/pusher.example.json'), 'utf8'));

  await expect(configSchema.parseAsync(config)).resolves.toEqual(expect.any(Object));
});
