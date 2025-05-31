module.exports = {
  root: true,
  ignorePatterns: ['projects/**/*', 'dist/**/*', 'node_modules/**/*', '**/*.html'],
  env: {
    browser: true,
    es2021: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // Console statements disabled for now - many debug statements exist
    // LoggerService is available for new code: src/app/services/logger.service.ts
    // TODO: Gradually replace console.log with LoggerService.log() for production-ready logging
    'no-console': 'off',
    'prefer-const': 'error',
    'no-var': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
  },
}; 