import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', '**/*.js'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Casts like the former `(exifr as any).extractThumbnail` hid a real
      // production bug, so app code may not use `any`.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Test doubles for browser APIs (workers, directory readers) are loosely
    // typed on purpose; keep `any` visible there without failing CI.
    files: ['src/test/**/*.{ts,tsx}', 'vitest.config.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
