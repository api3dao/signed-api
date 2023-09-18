// This file loads secrets.env for serverless - take from https://github.com/api3dao/airkeeper
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// eslint-disable-next-line functional/immutable-data
module.exports = async ({ _options, _resolveConfigurationProperty }) => {
  const secretsPath = path.resolve(__dirname, '..', 'config', 'secrets.env');
  const envVars = fs.existsSync(secretsPath)
    ? dotenv.config({
        // Load env vars into Serverless environment
        path: secretsPath,
      }).parsed
    : {};
  // Return all env vars that don't start with "AWS_"
  return Object.keys(envVars)
    .filter((key) => !key.startsWith('AWS_'))
    .reduce((obj, key) => {
      return { ...obj, [key]: envVars[key] };
    }, {});
};
