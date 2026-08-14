import tsParser from '@typescript-eslint/parser';
import {
  PURE_PACKAGE_EXTENSIONS,
  PURE_PACKAGE_GLOBS,
  IMPURE_PACKAGE_GLOBS,
  PURE_RESTRICTED_GLOBALS,
  PURE_RESTRICTED_SYNTAX,
  PURE_RESTRICTED_IMPORTS
} from './tools/lint/pure-rules.mjs';

const TS_EXTENSIONS_GLOB = `**/*.{${PURE_PACKAGE_EXTENSIONS.join(',')}}`;

const PURE_RULES = {
  'no-console': 'error',
  'no-restricted-globals': ['error', ...PURE_RESTRICTED_GLOBALS],
  'no-restricted-syntax': ['error', ...PURE_RESTRICTED_SYNTAX],
  'no-restricted-imports': ['error', PURE_RESTRICTED_IMPORTS]
};

const IMPURE_OVERRIDES = {
  'no-console': 'off',
  'no-restricted-globals': 'off',
  'no-restricted-syntax': 'off',
  'no-restricted-imports': 'off'
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.tsbuildinfo',
      'benchmark/**',
      'tests/fixtures/**',
      'docs/decisions/**'
    ]
  },
  {
    files: [TS_EXTENSIONS_GLOB],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {}
  },
  {
    files: PURE_PACKAGE_GLOBS,
    rules: PURE_RULES
  },
  {
    files: IMPURE_PACKAGE_GLOBS,
    rules: IMPURE_OVERRIDES
  }
];
