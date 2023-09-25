import { readFileSync } from 'fs';
import { join } from 'path';
import { configSchema } from './schema';

it('validates example config', () => {
  const config = JSON.parse(readFileSync(join(__dirname, '../../config/pusher.example.json'), 'utf8'));

  expect(() => configSchema.parse(config)).not.toThrow();
});
