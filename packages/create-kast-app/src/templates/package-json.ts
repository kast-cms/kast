export const PACKAGE_JSON_TEMPLATE = `{
  "name": "{{projectName}}",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "typecheck": "turbo typecheck",
    "lint": "turbo lint",
    "db:generate": "{{dbGenerateCmd}}",
    "db:migrate": "{{dbMigrateCmd}}",
    "db:migrate:prod": "{{dbMigrateProdCmd}}",
    "db:seed": "{{dbSeedCmd}}",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    "prepare": "husky"
  },
  "engines": {
    "node": ">=20"
  },
  "packageManager": "{{packageManager}}@{{pmVersion}}",
  "devDependencies": {
    "turbo": "^2.5.0",
    "typescript": "^5.8.3",
    "eslint": "^9.24.0",
    "globals": "^16.0.0",
    "typescript-eslint": "^8.30.0",
    "prettier": "^3.5.3",
    "prettier-plugin-organize-imports": "^4.1.0",
    "husky": "^9.1.7",
    "lint-staged": "^15.5.1",
    "dotenv-cli": "^11.0.0",
    "@commitlint/cli": "^19.8.0",
    "@commitlint/config-conventional": "^19.8.0",
    "@commitlint/types": "^19.8.0"
  }{{#if isPnpmLegacyConfig}},
  "pnpm": {
    "onlyBuiltDependencies": [
      "@parcel/watcher",
      "@prisma/client",
      "@prisma/engines",
      "@swc/core",
      "argon2",
      "esbuild",
      "msgpackr-extract",
      "prisma",
      "sharp"
    ]
  }{{/if}}{{#unless isPnpm}},
  "workspaces": [
    "apps/*",
    "packages/*",
    "plugins/*"
  ]{{/unless}}
}
`;

export const PACKAGE_JSON_API_ONLY_TEMPLATE = `{
  "name": "{{projectName}}",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build{{#if pluginMeilisearch}} && tsc -p plugins/kast-plugin-meilisearch/tsconfig.json{{/if}}{{#if pluginStripe}} && tsc -p plugins/kast-plugin-stripe/tsconfig.json{{/if}}{{#if pluginResend}} && tsc -p plugins/kast-plugin-resend/tsconfig.json{{/if}}{{#if pluginR2}} && tsc -p plugins/kast-plugin-r2/tsconfig.json{{/if}}{{#if pluginSentry}} && tsc -p plugins/kast-plugin-sentry/tsconfig.json{{/if}}",
    "start": "node dist/main.js",
    "start:debug": "nest start --debug --watch",
    "lint": "eslint \\"src/**/*.ts\\" \\"test/**/*.ts\\" --no-error-on-unmatched-pattern",
    "lint:fix": "eslint \\"src/**/*.ts\\" \\"test/**/*.ts\\" --fix",
    "typecheck": "tsc --noEmit",
    "test": "jest --passWithNoTests",
    "test:e2e": "node test/prepare-e2e-db.mjs && jest --config ./test/jest-e2e.json",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:seed": "ts-node -r tsconfig-paths/register prisma/seed.ts",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f",
    "prepare": "husky"
  },
  "engines": {
    "node": ">=20"
  },
  "packageManager": "{{packageManager}}@{{pmVersion}}",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.600.0",
    "@aws-sdk/s3-request-presigner": "^3.600.0",
    "@bull-board/api": "^7.0.0",
    "@bull-board/express": "^7.0.0",
    "@bull-board/nestjs": "^7.0.0",
    "@bull-board/ui": "^7.0.0",
    "@kast-cms/plugin-sdk": "^0.1.0",
    "@modelcontextprotocol/node": "^2.0.0",
    "@modelcontextprotocol/server": "^2.0.0",
    "@nestjs/bullmq": "^10.2.3",
    "@nestjs/common": "^11.0.11",
    "@nestjs/config": "^3.3.0",
    "@nestjs/core": "^11.0.11",
    "@nestjs/event-emitter": "^3.0.1",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^11.0.11",
    "@nestjs/schedule": "^6.1.3",
    "@nestjs/swagger": "^8.1.0",
    "@nestjs/terminus": "^10.2.3",
    "@nestjs/throttler": "^6.2.1",
    "@prisma/client": "^6.5.0",
    "@sentry/node": "^10.58.0",
    "argon2": "^0.41.1",
    "bullmq": "^5.39.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "helmet": "^8.0.0",
    "ioredis": "^5.3.2",
    "isomorphic-dompurify": "^3.10.0",
    "jsonwebtoken": "^9.0.3",
    "meilisearch": "^0.58.0",
    "multer": "^2.2.0",
    "nodemailer": "^9.0.1",
    "passport": "^0.7.0",
    "passport-github2": "^0.1.12",
    "passport-google-oauth20": "^2.0.0",
    "passport-jwt": "^4.0.1",
    "prisma": "^6.5.0",
    "reflect-metadata": "^0.2.2",
    "resend": "^6.14.0",
    "rxjs": "^7.8.2",
    "sharp": "^0.35.0",
    "stripe": "^22.2.2",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.6",
    "@nestjs/schematics": "^11.0.4",
    "@nestjs/testing": "^11.0.11",
    "@types/express": "^5.0.1",
    "@types/jest": "^29.5.14",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/multer": "^2.0.0",
    "@types/node": "^22.14.0",
    "@types/nodemailer": "^8.0.0",
    "@types/passport": "^1.0.17",
    "@types/passport-github2": "^1.2.9",
    "@types/passport-google-oauth20": "^2.0.17",
    "@types/passport-jwt": "^4.0.1",
    "@types/sharp": "^0.32.0",
    "@types/supertest": "^6.0.2",
    "dompurify": "^3.4.1",
    "eslint": "^9.24.0",
    "globals": "^16.0.0",
    "typescript-eslint": "^8.30.0",
    "husky": "^9.1.7",
    "lint-staged": "^15.5.1",
    "@commitlint/cli": "^19.8.0",
    "@commitlint/config-conventional": "^19.8.0",
    "@commitlint/types": "^19.8.0",
    "jest": "^29.7.0",
    "prettier": "^3.5.3",
    "prettier-plugin-organize-imports": "^4.1.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.6",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.8.3"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\\\.spec\\\\.ts$",
    "transform": { "^.+\\\\.(t|j)s$": "ts-jest" },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }{{#if isPnpmLegacyConfig}},
  "pnpm": {
    "onlyBuiltDependencies": [
      "@prisma/client",
      "@prisma/engines",
      "argon2",
      "esbuild",
      "prisma",
      "sharp"
    ]
  }{{/if}}
}
`;

/**
 * A single-package pnpm 10+ project still needs pnpm-workspace.yaml, because
 * that is the only place those versions read build permissions from.
 */
export const API_ONLY_WORKSPACE_TEMPLATE = `{{#if isPnpmOnlyBuilt}}onlyBuiltDependencies:
  - '@prisma/client'
  - '@prisma/engines'
  - argon2
  - esbuild
  - prisma
  - sharp
{{/if}}{{#if isPnpmAllowBuilds}}allowBuilds:
  '@prisma/client': true
  '@prisma/engines': true
  '@scarf/scarf': false
  argon2: true
  esbuild: true
  prisma: true
  sharp: true
{{/if}}`;

export const WORKSPACE_TEMPLATE = `{{#if isPnpm}}packages:
  - 'apps/*'
  - 'packages/*'
  - 'plugins/*'
{{#if isPnpmOnlyBuilt}}
# pnpm 10 reads this here rather than from package.json. Without it the build
# scripts for argon2, sharp and Prisma are skipped and the API fails at runtime.
onlyBuiltDependencies:
  - '@parcel/watcher'
  - '@prisma/client'
  - '@prisma/engines'
  - '@swc/core'
  - argon2
  - esbuild
  - msgpackr-extract
  - prisma
  - sharp
{{/if}}{{#if isPnpmAllowBuilds}}
# pnpm 11 replaced onlyBuiltDependencies with this map, and fails the install if a
# dependency with a build script is listed neither way. The native modules the API
# needs are allowed; @scarf/scarf is telemetry and is declined.
allowBuilds:
  '@parcel/watcher': true
  '@prisma/client': true
  '@prisma/engines': true
  '@scarf/scarf': false
  '@swc/core': true
  argon2: true
  esbuild: true
  msgpackr-extract: true
  prisma: true
  sharp: true
{{/if}}{{/if}}`;
