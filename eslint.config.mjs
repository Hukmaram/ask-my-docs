import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '**/dist/**',
      'coverage/**',
      'data/**',
      'frontend/**',
    ],
  },

  eslint.configs.recommended,

  ...tseslint.configs.recommended,

  {
    files: ['**/*.ts'],

    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  prettier,
);
