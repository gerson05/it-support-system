import js from '@eslint/js';
import globals from 'globals';
import security from 'eslint-plugin-security';

export default [
  {
    ignores: [
      'node_modules/',
      'coverage/',
      'dist/',
      'agent/dist/',
      'public/_SCRIPT_TEMPLATE.js',
    ],
  },

  js.configs.recommended,

  // Backend, scripts and tests: Node ESM
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
  },

  // CommonJS: Windows agent and *.cjs files
  {
    files: ['agent/**/*.js', '**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },

  // Frontend: browser ES modules + CDN globals loaded via <script>
  {
    files: ['public/**/*.js', 'public/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.browser,
        Chart: 'readonly',
        lucide: 'readonly',
        // Optional globals, always accessed behind a `typeof` guard
        Router: 'readonly',
        DEBUG: 'readonly',
      },
    },
  },

  // Security rules for server-side code only
  {
    files: ['server.js', 'src/**/*.js'],
    ...security.configs.recommended,
  },

  {
    rules: {
      // Errors: likely bugs. Warnings: existing debt, to be cleaned up gradually.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'no-useless-assignment': 'warn',
      'no-redeclare': 'warn',
      'no-irregular-whitespace': ['error', { skipRegExps: true }],
      // Flags every obj[key] access; far too noisy to be useful here
      'security/detect-object-injection': 'off',
    },
  },

  // Legacy frontend modules that reference API/DOM, which are never defined
  // (module-scoped in ESM). Nothing imports their exports; pending removal.
  {
    files: [
      'public/js/features/*/*-service.js',
      'public/js/ui/modal.js',
      'public/js/ui/toast.js',
    ],
    rules: {
      'no-undef': 'warn',
    },
  },
];
