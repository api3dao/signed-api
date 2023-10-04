module.exports = {
  extends: ['./node_modules/commons/dist/eslint/universal', './node_modules/commons/dist/eslint/jest'],
  parserOptions: {
    project: ['./tsconfig.json'], // The monorepo packages extend this config, so the "./tsconfig.json" will actually be the correct one for each package.
  },
};
