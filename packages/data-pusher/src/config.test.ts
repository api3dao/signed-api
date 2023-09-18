import fs from 'fs';
import path from 'path';
import { mockReadFileSync } from '../test/mock-utils';
import { interpolateSecrets, parseSecrets, parseConfig, parseConfigWithSecrets, loadConfig } from './config';

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'airseeker.example.json'), 'utf8'));
const envVariables = {
  AIRSEEKER_WALLET_MNEMONIC: 'achieve climb couple wait accident symbol spy blouse reduce foil echo label',
  CP_SELF_HOSTED_MAINNET_URL: 'https://some.self.hosted.mainnet.url',
  CP_INFURA_MAINNET_URL: 'https://some.infura.mainnet.url',
  CP_INFURA_ROPSTEN_URL: 'https://some.influra.ropsten.url',
  HTTP_SIGNED_DATA_GATEWAY_KEY: '18e06827-8544-4b0f-a639-33df3b5bc62f',
  HTTP_SIGNED_DATA_GATEWAY_URL: 'https://some.http.signed.data.gateway.url/',
  SS_CURRENCY_CONVERTER_API_KEY: '164mTCl3fzd7VcIDQMHtq5',
};

describe('interpolateSecrets', () => {
  it('interpolates variables', () => {
    const interpolatedString = 'Lorem ipsum dolor sit amet';
    const stringWithVariables = 'Lorem ipsum dolor ${VAR1} ${VAR2}';
    const envVars = {
      VAR1: 'sit',
      VAR2: 'amet',
    };

    expect(interpolateSecrets(stringWithVariables, envVars)).toEqual(interpolatedString);
  });

  it('keeps the content the same if there are no variables', () => {
    const stringWithNoVariables = 'Lorem ipsum dolor sit amet';
    const envVariables = {
      VAR1: 'sit',
      VAR2: 'amet',
    };

    expect(interpolateSecrets(stringWithNoVariables, envVariables)).toEqual(stringWithNoVariables);
  });
});

describe('parseSecrets', () => {
  it('makes sure secrets are in a correct format (record of strings)', () => {
    const secrets = {
      key01: 'value01',
      key02: 'value02',
      key03: 'value03',
    };

    expect(parseSecrets(secrets).success).toBeTruthy();
  });

  it('fails when parsing secrets in invalid format', () => {
    const secrets = {
      key01: 'value01',
      key02: 'value02',
      object01: {
        key03: 'value03',
      },
    };

    expect(parseSecrets(secrets).success).toBeFalsy();
  });
});

describe('parseConfig', () => {
  it('parses the correct config', () => {
    const interpolatedConfig = interpolateSecrets(config, envVariables);
    expect(parseConfig(interpolatedConfig).success).toBeTruthy();
  });

  it('fails with an invalid config', () => {
    const interpolatedConfig = interpolateSecrets(config, envVariables);
    interpolatedConfig['triggers'] = '';
    expect(parseConfig(interpolatedConfig).success).toBeFalsy();
  });
});

describe('parseConfigWithSecrets', () => {
  it('parses the correct config and interpolates secrets', () => {
    expect(parseConfigWithSecrets(config, envVariables).success).toBeTruthy();
  });

  it('fails with missing secrets', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { CP_SELF_HOSTED_MAINNET_URL, ...envVariablesMissing } = envVariables;
    expect(() => parseConfigWithSecrets(config, envVariablesMissing)).toThrow();
  });

  it('fails with invalid config', () => {
    const invalidConfig = { ...config, templates: '' };
    expect(parseConfigWithSecrets(invalidConfig, envVariables).success).toBeFalsy();
  });
});

describe('loadConfig', () => {
  it('loads config without an error', () => {
    let loadedConfig;
    const interpolatedConfig = interpolateSecrets(config, envVariables);
    mockReadFileSync('airseeker.json', JSON.stringify(config));

    expect(() => {
      loadedConfig = loadConfig('/dummy/config/path/airseeker.json', envVariables);
    }).not.toThrow();
    expect(loadedConfig).toEqual(interpolatedConfig);
  });

  it('fails with missing secrets', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { CP_SELF_HOSTED_MAINNET_URL, ...envVariablesMissing } = envVariables;
    mockReadFileSync('airseeker.json', JSON.stringify(config));

    expect(() =>
      loadConfig('/dummy/config/path/airseeker.json', envVariablesMissing as unknown as Record<string, string>)
    ).toThrow();
  });

  it('fails with invalid config', () => {
    const invalidConfig = { ...config, chains: '' };
    mockReadFileSync('config-invalid.json', JSON.stringify(invalidConfig));

    expect(() => loadConfig('/dummy/config/path/config-invalid.json', envVariables)).toThrow();
  });
});
