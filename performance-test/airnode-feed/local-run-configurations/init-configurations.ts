import fs from 'node:fs';
import path from 'node:path';

import { ethers } from 'ethers';

const srcDir = '1';

// Function to recursively copy a directory
const copyDirectory = (src: string, dest: string) => {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const files = fs.readdirSync(src);

  for (const file of files) {
    const currentSrc = path.join(src, file);
    const currentDest = path.join(dest, file);

    if (fs.lstatSync(currentSrc).isDirectory()) {
      copyDirectory(currentSrc, currentDest);
    } else {
      fs.copyFileSync(currentSrc, currentDest);
    }
  }
};

// Loop from 2 to 30
for (let i = 2; i <= 30; i++) {
  const destDir = i.toString();

  // Remove the destination directory if it exists
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }

  // Copy the source directory to the destination directory
  copyDirectory(srcDir, destDir);
  console.info(`Copied ${srcDir} to ${destDir}`);

  // Change the mnemonic for each of the Airnode feeds
  const mnemonic = ethers.Wallet.createRandom().mnemonic.phrase;
  const configPath = path.join(destDir, 'config/airnode-feed.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.nodeSettings.airnodeWalletMnemonic = mnemonic;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.info(`Changed mnemonic for ${destDir}`);
}
