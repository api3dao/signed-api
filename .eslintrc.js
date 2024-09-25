module.exports = {
  extends: ['plugin:@api3/eslint-plugin-commons/universal', 'plugin:@api3/eslint-plugin-commons/jest'],
  parserOptions: {
    project: ['./tsconfig.json', './packages/*/tsconfig.json'],
  },
  rules: {},
};
