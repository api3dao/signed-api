module.exports = {
  extends: ['plugin:@api3/eslint-plugin-commons/universal', 'plugin:@api3/eslint-plugin-commons/jest'],
  parserOptions: {
    project: ['./tsconfig.json', './packages/*/tsconfig.json'],
  },
  rules: {
    '@typescript-eslint/prefer-destructuring': 'off', // The commons universal ESLint configuration already uses "prefer-destructuring" and this extended version is not needed.
    '@typescript-eslint/max-params': 'off', // It is sometimes necessary to have enough arguments. This rule is too strict.

    '@typescript-eslint/prefer-nullish-coalescing': 'off', // This rule throws an error with ESLint plugin and parser @6.19.0.
    '@typescript-eslint/consistent-return': 'off', // Triggers multiple false positives, e.g. in exhaustive switch cases or zod transformations.

    'jest/prefer-importing-jest-globals': 'off',
  },
};
