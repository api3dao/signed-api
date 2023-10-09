module.exports = {
  extends: ['./node_modules/@api3/commons/dist/eslint/universal', './node_modules/@api3/commons/dist/eslint/jest'],
  parserOptions: {
    project: ['./tsconfig.json', './packages/*/tsconfig.json'],
  },
};
