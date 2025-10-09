// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // Если будут нужны типовые правила с type-aware — добавим project
        // project: ['./tsconfig.json', './frontend/tsconfig.json', './backend/tsconfig.json'],
      },
    },
    rules: {
      // добавишь свои правила при желании
    },
  },
];