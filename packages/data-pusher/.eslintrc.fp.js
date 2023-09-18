module.exports = {
  plugins: ['functional'],
  rules: {
    // eslint-plugin-functional
    'functional/prefer-tacit': 0,
    'functional/immutable-data': ['error', { assumeTypes: true, ignoreClasses: true }],
  },
  overrides: [
    {
      files: [
        // Test files
        '**/*.test.js',
        '**/*.test.ts',
        '**/*.feature.ts',
        '**/test/**',
        // Config files
        '.eslintrc.js',
        '.eslintrc.fp.js',
      ],
      rules: {
        'functional/immutable-data': 'off',
      },
    },
  ],
};
