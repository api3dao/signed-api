module.exports = {
  plugins: ['functional'],
  rules: {
    // eslint-plugin-functional
    // 'functional/prefer-tacit': ['warn', { assumeTypes: { allowFixer: false } }],
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
