import typescriptEslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**']
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslint.plugin
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Warn rather than fail: ~190 pre-existing `any`s predate this rule being
      // enforced. Type them file by file, then set this back to 'error'.
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': [
        'warn',
        { allow: ['warn', 'error'] }
      ]
    }
  }
];
