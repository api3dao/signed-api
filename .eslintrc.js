module.exports = {
  extends: ['./node_modules/@api3/commons/dist/eslint/universal', './node_modules/@api3/commons/dist/eslint/jest'],
  parserOptions: {
    project: ['./tsconfig.json', './packages/*/tsconfig.json'],
  },
  rules: {
    '@typescript-eslint/prefer-destructuring': 'off', // The commons universal ESLint configuration already uses "prefer-destructuring" and this extended version is not needed.
    '@typescript-eslint/max-params': 'off', // It is sometimes necessary to have enough arguments. This rule is too strict.

    '@typescript-eslint/prefer-nullish-coalescing': 'off', // This rule throws an error with ESLint plugin and parser @6.19.0.
  },
};
