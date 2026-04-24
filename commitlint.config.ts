import type { UserConfig } from '@commitlint/types';

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    'scope-enum': [
      2,
      'always',
      [
        // Modules
        'content',
        'seo',
        'auth',
        'media',
        'mcp',
        'i18n',
        'audit',
        'webhook',
        'queue',
        'plugin',
        'form',
        'menu',
        'settings',
        'trash',
        'health',
        // Apps/packages
        'admin',
        'api',
        'sdk',
        'cli',
        'docs',
        'ui',
        // Meta
        'deps',
        'config',
        'ci',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
    'subject-empty': [2, 'never'],
    'type-empty': [2, 'never'],
  },
};

export default config;
