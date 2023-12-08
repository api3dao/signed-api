import fs from 'node:fs';
import path from 'node:path';

import prettier from 'prettier';

const main = async () => {
  if (!process.env.SIGNED_API_URL) {
    throw new Error('SIGNED_API_URL env var not set');
  }

  for (let i = 1; i <= 300; i++) {
    const destDir = i.toString();

    // Change the Signed API URL for each of the Airnode feeds
    const configPath = path.join(__dirname, destDir, 'config/airnode-feed.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.signedApis[0]!.url = process.env.SIGNED_API_URL;
    const options = await prettier.resolveConfig(configPath);
    const formattedFile = await prettier.format(JSON.stringify(config, null, 2), { ...options!, parser: 'json' });
    fs.writeFileSync(configPath, formattedFile);

    console.info(`Changed Signed API URL for ${configPath}`);
  }
};

void main();
