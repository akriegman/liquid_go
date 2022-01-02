/* eslint-env node */
module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 13,
    sourceType: 'module',
  },
  plugins: ['react'],
  rules: {
    indent: [
      'error',
      2,
    ],
    'linebreak-style': [
      'error',
      'unix',
    ],
    quotes: [
      'error',
      'single',
    ],
    semi: [
      'error',
      'always',
    ],
    'arrow-parens': ['error', 'as-needed'],
    'react/prop-types': 'off',
    'object-curly-spacing': ['error', 'always'],
    'space-infix-ops': 'error',
    'react/no-unescaped-entities': 'off',
    'react/jsx-key': 'off',
    'no-unused-vars': 'warn'
    // 'no-unused-vars': 'warn',

    /*
     * 'no-magic-numbers': 'off',
     * 'sort-keys': 'off',
     * 'padded-blocks': 'off',
     * 'function-call-argument-newline': 'off',
     * 'space-before-function-paren': 'off',
     * 'comma-dangle': ['error', 'always-multiline'],
     * 'array-element-newline': 'off',
     * 'dot-location': ['error', 'property'],
     * 'no-ternary': 'off',
     * 'no-nested-ternary': 'off',
     * 'no-confusing-arrow': 'off',
     * 'id-length': 'off',
     * 'quote-props': ['error', 'as-needed'],
     * 'multiline-ternary': 'off',
     */
  },
};
