module.exports = {
  root: true,
  extends: ['expo', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'import'],
  ignorePatterns: ['node_modules', 'dist', 'android', 'ios', '.expo'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/consistent-type-imports': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    // Guard rails for the security requirements.
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@react-native-async-storage/async-storage',
            message:
              'Never store tokens or PII in AsyncStorage. Use @/services/secure-storage (expo-secure-store) or @/services/kv (MMKV) instead.',
          },
        ],
      },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "CallExpression[callee.object.name='console'][callee.property.name='log']",
        message: 'Use the structured logger in @/services/logger instead of console.log.',
      },
    ],
  },
};
