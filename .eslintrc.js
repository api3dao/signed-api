module.exports = {
  extends: ['./node_modules/@api3/commons/dist/eslint/universal', './node_modules/@api3/commons/dist/eslint/jest'],
  parserOptions: {
    project: ['./tsconfig.json', './packages/*/tsconfig.json'],
  },
  rules: {
    '@typescript-eslint/prefer-destructuring': 'off', // The commons universal ESLint configuration already uses "prefer-destructuring" and this extended version is not needed.
  },
};
