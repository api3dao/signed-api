module.exports = {
  extends: ['./node_modules/commons/dist/eslint/universal', './node_modules/commons/dist/eslint/jest'],
  parserOptions: {
    project: ['./tsconfig.json', './packages/*/tsconfig.json'],
  },
  rules: {
    // TODO: Remove this once the eslint configuration is settled.
    'multiline-comment-style': 'off',
    'unicorn/no-array-callback-reference': 'off', // We prefer point free notation using "functional/prefer-tacit" rule.
    '@typescript-eslint/unbound-method': 'off', // Reports issues for common patterns in tests (e.g. "expect(logger.warn)..."). Often the issue yields false positives.
    'jest/no-hooks': [
      'error', // Prefer using setup functions instead of beforeXXX hooks. AfterXyz are sometimes necessary (e.g. to reset Jest timers).
      {
        allow: ['afterEach', 'afterAll'],
      },
    ],
  },
};
