import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  { files:['lab/**/*.mjs','playwright.config.mjs'],languageOptions:{globals:{...globals.browser,...globals.node,...globals.es2020}},rules:js.configs.recommended.rules },
  {
    files: ['src/**/*.{ts,tsx}', 'vite.config.ts'],
    languageOptions: { parser: tseslint.parser, globals: { ...globals.browser, ...globals.es2020, ...globals.node } },
    plugins: { '@typescript-eslint': tseslint.plugin, 'react-hooks': hooks, 'react-refresh': refresh },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.plugin.configs['eslint-recommended'].overrides[0].rules,
      ...tseslint.plugin.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
];
