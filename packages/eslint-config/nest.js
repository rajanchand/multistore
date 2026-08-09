import base from './base.js';

/** NestJS ESLint config (flat). */
export default [
  ...base,
  {
    rules: {
      // Nest DI relies on parameter properties and empty constructors.
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
