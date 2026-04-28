export const PACKAGE_JSON_TEMPLATE = `{
  "name": "{{projectName}}",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "lint": "turbo lint",
    "db:generate": "{{packageManager}} --filter @kast-cms/api run prisma:generate",
    "db:migrate": "{{packageManager}} --filter @kast-cms/api run prisma:migrate",
    "db:migrate:prod": "{{packageManager}} --filter @kast-cms/api run prisma:migrate:prod",
    "db:seed": "{{packageManager}} --filter @kast-cms/api run prisma:seed",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f"
  },
  "engines": {
    "node": ">=20"
  },
  "packageManager": "{{packageManager}}@{{pmVersion}}"{{#unless isPnpm}},
  "workspaces": [
    "apps/*",
    "packages/*",
    "plugins/*"
  ]{{/unless}}
}
`;

export const WORKSPACE_TEMPLATE = `{{#if isPnpm}}packages:
  - 'apps/*'
  - 'packages/*'
  - 'plugins/*'
{{/if}}`;
