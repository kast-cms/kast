export const PACKAGE_JSON_TEMPLATE = `{
  "name": "{{projectName}}",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "dev": "docker-compose up",
    "up": "docker-compose up",
    "up:detach": "docker-compose up -d",
    "down": "docker-compose down",
    "logs": "docker-compose logs -f",
    "logs:api": "docker-compose logs -f api",
    "ps": "docker-compose ps"
  },
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  },
  "packageManager": "pnpm@9.0.0"
}
`;

export const PNPM_WORKSPACE_TEMPLATE = `packages:
  - 'apps/*'
  - 'packages/*'
  - 'plugins/*'
`;
