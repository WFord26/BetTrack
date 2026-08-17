// @ts-check
const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '*.config.js',
      'jest.config.js',
      'prisma.config.ts'
    ]
  },
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      }
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      // Use the Winston logger from src/config/logger.ts instead of console.
      'no-console': 'error',
    }
  },
  {
    // Bootstrap code that runs before (or defines) the logger, plus the token
    // script whose output is a secret that must never reach the log files.
    files: [
      'src/config/logger.ts',
      'src/config/env.ts',
      'src/scripts/create-api-token.ts'
    ],
    rules: {
      'no-console': 'off',
    }
  }
];
