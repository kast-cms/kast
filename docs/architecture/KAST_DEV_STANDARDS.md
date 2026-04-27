# KAST CMS — Development Standards

### _How we write code. How we stay sane._

> Every rule here exists for a reason. No cargo-culting. No style debates.

---

## Table of Contents

1. [Core Principle](#1-core-principle)
2. [TypeScript Configuration](#2-typescript-configuration)
3. [ESLint Configuration](#3-eslint-configuration)
4. [Prettier Configuration](#4-prettier-configuration)
5. [File & Folder Naming](#5-file--folder-naming)
6. [File Length Limits](#6-file-length-limits)
7. [NestJS Module Structure](#7-nestjs-module-structure)
8. [Next.js App Structure](#8-nextjs-app-structure)
9. [Code Style Rules](#9-code-style-rules)
10. [Import Organization](#10-import-organization)
11. [Git Workflow](#11-git-workflow)
12. [Commit Convention](#12-commit-convention)
13. [Pre-commit Hooks](#13-pre-commit-hooks)
14. [Testing Standards](#14-testing-standards)
15. [Documentation Standards](#15-documentation-standards)
16. [Environment & Config](#16-environment--config)
17. [Error Handling](#17-error-handling)
18. [Tooling Summary](#18-tooling-summary)

---

## 1. Core Principle

> **If it compiles with warnings, it's broken. If it ships without tests, it's a bug waiting to happen. If it has no type, it doesn't exist.**

Kast enforces strictness at every layer — TypeScript, ESLint, git hooks, CI — so that bugs are caught locally before they become production problems.

Three words define how we write code here:

- **Strict** — no escape hatches, no `any`, no implicit types
- **Consistent** — same structure, same patterns, everywhere
- **Obvious** — code that reads like documentation

---

## 2. TypeScript Configuration

### Root `tsconfig.base.json`

Shared across all apps and packages in the monorepo:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

### `apps/api/tsconfig.json` (NestJS)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "verbatimModuleSyntax": false,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "outDir": "./dist",
    "baseUrl": ".",
    "paths": {
      "@kast/*": ["../../packages/*/src"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

> NestJS requires `CommonJS` and decorators. These are the only exceptions to the base config.

### `apps/admin/tsconfig.json` (Next.js)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "verbatimModuleSyntax": false,
    "jsx": "preserve",
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@kast/*": ["../../packages/*/src"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### What Each Strict Flag Means

| Flag                         | What It Catches                                            |
| ---------------------------- | ---------------------------------------------------------- |
| `strict: true`               | Enables all strict sub-flags below                         |
| `noUncheckedIndexedAccess`   | `arr[0]` is `T \| undefined`, not `T` — forces null checks |
| `noImplicitOverride`         | Must write `override` keyword explicitly                   |
| `noUnusedLocals`             | No dead variables                                          |
| `noUnusedParameters`         | No dead function parameters                                |
| `exactOptionalPropertyTypes` | `{ a?: string }` cannot be `{ a: undefined }`              |
| `noFallthroughCasesInSwitch` | Every switch case must break or return                     |
| `verbatimModuleSyntax`       | Forces `import type` for type-only imports                 |

### Rules

- ❌ **Never use `any`** — use `unknown` and narrow it
- ❌ **Never use `as Type`** unless you're in a test or a very specific adapter boundary
- ❌ **Never use `@ts-ignore`** — fix the type instead
- ✅ Use `satisfies` over `as` when validating object shape
- ✅ Use `import type { ... }` for all type-only imports

```typescript
// ❌ Wrong
const data = response as UserDto;
const id = req.params.id as string;

// ✅ Right
const data = UserDto.parse(response); // zod or class-validator
const id = req.params['id'];
if (typeof id !== 'string') throw new BadRequestException('...');
```

---

## 3. ESLint Configuration

### Architecture

One root `eslint.config.ts` (ESLint v9 flat config), with scoped overrides per workspace:

```
kast/
├── eslint.config.ts          ← root config, applies everywhere
├── apps/
│   ├── api/
│   │   └── eslint.config.ts  ← NestJS-specific rules
│   └── admin/
│       └── eslint.config.ts  ← Next.js-specific rules
└── packages/
    └── eslint.config.ts      ← shared packages rules
```

### Root `eslint.config.ts`

```typescript
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**', '**/coverage/**'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      // TypeScript — strict
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // General code quality
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
      'no-throw-literal': 'error',

      // File complexity
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 4],
      complexity: ['error', 10],
    },
  },
);
```

### `apps/api/eslint.config.ts` (NestJS additions)

```typescript
import rootConfig from '../../eslint.config';

export default [
  ...rootConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      // NestJS uses classes + decorators — some rules need tuning
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // No console.log in NestJS — use Logger service
      'no-console': 'error',
    },
  },
  {
    // Relax rules in test files
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines-per-function': 'off',
    },
  },
];
```

### `apps/admin/eslint.config.ts` (Next.js additions)

```typescript
import rootConfig from '../../eslint.config';
import nextPlugin from '@next/eslint-plugin-next';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';

export default [
  ...rootConfig,
  {
    files: ['**/*.tsx', '**/*.ts'],
    plugins: {
      next: nextPlugin,
      react: reactPlugin,
      'react-hooks': hooksPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...hooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
];
```

---

## 4. Prettier Configuration

Single `prettier.config.ts` at the root — no per-package overrides:

```typescript
import type { Config } from 'prettier';

const config: Config = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: ['prettier-plugin-organize-imports'],
};

export default config;
```

**Rules:**

- Prettier handles all formatting. ESLint handles code quality. Never mix them.
- `prettier-plugin-organize-imports` auto-sorts imports on format
- Line width is 100 characters — not 80, not 120

---

## 5. File & Folder Naming

### Universal Rules

| Thing           | Convention                                  | Example                               |
| --------------- | ------------------------------------------- | ------------------------------------- |
| Folders         | `kebab-case`                                | `content-type/`, `seo-module/`        |
| Files (NestJS)  | `kebab-case.type.ts`                        | `content.service.ts`                  |
| Files (Next.js) | `kebab-case` or `PascalCase` for components | `content-list.tsx`, `ContentCard.tsx` |
| Interfaces      | `I` prefix — **never**                      | `ContentEntry`, not `IContentEntry`   |
| Types           | `PascalCase`                                | `CreateEntryDto`, `SeoReport`         |
| Enums           | `PascalCase`                                | `ContentStatus`, `UserRole`           |
| Constants       | `SCREAMING_SNAKE_CASE`                      | `MAX_FILE_SIZE`, `DEFAULT_LOCALE`     |
| Env vars        | `SCREAMING_SNAKE_CASE`                      | `DATABASE_URL`, `JWT_SECRET`          |

### NestJS File Suffixes (enforced)

Every file in `apps/api/src/modules/**` must end with one of these:

```
*.module.ts       → NestJS module definition
*.controller.ts   → HTTP controller
*.service.ts      → Business logic
*.repository.ts   → Database access layer
*.dto.ts          → Data Transfer Objects (input validation)
*.entity.ts       → Database entity / Prisma model type
*.guard.ts        → Auth guards
*.interceptor.ts  → Request/response interceptors
*.pipe.ts         → Validation/transformation pipes
*.decorator.ts    → Custom decorators
*.middleware.ts   → HTTP middleware
*.filter.ts       → Exception filters
*.types.ts        → Module-local shared types
*.constants.ts    → Module-local constants
*.spec.ts         → Unit test
*.e2e-spec.ts     → E2E test
```

### Example Module Folder

```
src/modules/content/
├── content.module.ts
├── content.controller.ts
├── content.service.ts
├── content.repository.ts
├── dto/
│   ├── create-content.dto.ts
│   ├── update-content.dto.ts
│   └── content-query.dto.ts
├── entities/
│   └── content-entry.entity.ts
├── content.constants.ts
├── content.types.ts
└── content.service.spec.ts
```

---

## 6. File Length Limits

These are **enforced by ESLint** — not suggestions:

| File Type         | Max Lines | Why                                         |
| ----------------- | --------- | ------------------------------------------- |
| Service file      | 300       | If it needs more, split into sub-services   |
| Controller file   | 200       | Controllers route, they don't think         |
| DTO file          | 100       | One DTO per file                            |
| Module file       | 80        | Modules should just wire things up          |
| Component (React) | 250       | Extract sub-components                      |
| Hook (React)      | 150       | Extract sub-hooks                           |
| Test file         | 400       | Tests can be longer, they document behavior |

**Function length limit: 50 lines** (enforced by ESLint `max-lines-per-function`).

If a function needs more than 50 lines:

- It is doing more than one thing
- Extract the secondary concern into a private method or helper

**Maximum nesting depth: 4** (enforced by ESLint `max-depth`).

```typescript
// ❌ Too deep (depth 5)
if (a) {
  if (b) {
    for (const x of arr) {
      if (c) {
        if (d) {
          // depth 5 — error
        }
      }
    }
  }
}

// ✅ Extract early returns and helper functions
if (!a || !b) return;
for (const x of arr) {
  processItem(x, c, d);
}
```

---

## 7. NestJS Module Structure

### Module Anatomy

Every Kast module follows this exact internal structure:

```typescript
// content.module.ts
@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: CONTENT_QUEUE })],
  controllers: [ContentController],
  providers: [ContentService, ContentRepository, ContentSeoConsumer],
  exports: [ContentService], // Only export what other modules need
})
export class ContentModule {}
```

### Service Rules

```typescript
@Injectable()
export class ContentService {
  // 1. Constructor — only inject what you use
  constructor(
    private readonly contentRepository: ContentRepository,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(CONTENT_QUEUE) private readonly contentQueue: Queue,
  ) {}

  // 2. Public methods — business logic entry points
  async createEntry(dto: CreateContentDto, userId: string): Promise<ContentEntry> {
    const entry = await this.contentRepository.create(dto, userId);
    this.eventEmitter.emit('content.created', entry);
    return entry;
  }

  // 3. Private methods — internal helpers only
  private buildSlug(title: string, locale: string): string {
    return `${locale}/${slugify(title)}`;
  }
}
```

**Service rules:**

- Services contain **business logic only** — no Prisma calls directly
- All database access goes through a `*.repository.ts`
- All background jobs go through `@InjectQueue` and BullMQ
- All cross-module communication goes through `EventEmitter2`
- Services never call other module's repositories — only their public services

### Controller Rules

```typescript
@Controller('content')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post()
  @Roles(UserRole.Editor, UserRole.Admin)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateContentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ContentEntryDto> {
    return this.contentService.createEntry(dto, user.id);
  }
}
```

**Controller rules:**

- Controllers are **thin** — they validate input, call the service, return output
- Never put business logic in a controller
- Every endpoint must have a guard
- Every endpoint must declare its role requirement
- Always specify `@HttpCode` explicitly

### DTO Rules

```typescript
// create-content.dto.ts
import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateContentDto {
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  title: string;

  @IsEnum(ContentType)
  type: ContentType;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  body?: string;
}
```

**DTO rules:**

- Always use `class-validator` decorators — never raw validation
- DTOs are input validation only — no output formatting
- Use a separate `*.response.dto.ts` for response shape (or use types)
- Never expose database IDs or internal fields in response DTOs

### Repository Rules

```typescript
// content.repository.ts
@Injectable()
export class ContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ContentEntry | null> {
    return this.prisma.contentEntry.findUnique({ where: { id } });
  }

  async create(data: Prisma.ContentEntryCreateInput): Promise<ContentEntry> {
    return this.prisma.contentEntry.create({ data });
  }
}
```

**Repository rules:**

- Only the repository touches Prisma directly
- Repositories return raw Prisma types — services map to DTOs
- No business logic in repositories
- Complex queries belong in the repository, not the service

---

## 8. Next.js App Structure

### Admin Panel (`apps/admin/`)

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   └── (dashboard)/
│       ├── content/
│       │   ├── [type]/
│       │   │   ├── page.tsx          ← list view
│       │   │   └── [id]/
│       │   │       └── page.tsx      ← edit view
│       │   └── layout.tsx
│       ├── media/
│       ├── seo/
│       └── settings/
├── components/
│   ├── ui/                           ← generic UI (Button, Input, etc.)
│   ├── content/                      ← content-specific components
│   ├── seo/                          ← SEO panel components
│   └── layout/                       ← sidebar, navbar, etc.
├── hooks/
│   ├── use-content.ts
│   └── use-seo-score.ts
├── lib/
│   ├── api.ts                        ← API client wrapper
│   ├── auth.ts                       ← Auth helpers
│   └── utils.ts                      ← General utils
├── types/
│   └── index.ts                      ← Frontend-local types
└── stores/
    └── content-store.ts              ← Zustand stores (if needed)
```

### Component Rules

```typescript
// ContentCard.tsx
import type { ContentEntry } from '@kast/core';

interface ContentCardProps {
  entry: ContentEntry;
  onPublish: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function ContentCard({ entry, onPublish, isLoading = false }: ContentCardProps): JSX.Element {
  // hooks first
  const [isPending, startTransition] = useTransition();

  // event handlers
  const handlePublish = (): void => {
    startTransition(async () => {
      await onPublish(entry.id);
    });
  };

  // render
  return (
    <div>...</div>
  );
}
```

**Component rules:**

- All components are **named exports** — never default exports (except page.tsx, layout.tsx)
- Props interface is always defined inline above the component
- Components never call the API directly — they receive data via props or server components
- Client components (`'use client'`) are the exception, not the rule
- Every component must have an explicit return type

---

## 9. Code Style Rules

### Naming Conventions

```typescript
// Classes — PascalCase
class ContentService {}
class CreateContentDto {}

// Interfaces — PascalCase, NO "I" prefix
interface ContentEntry {}
interface SeoReport {}

// Types — PascalCase
type ContentStatus = 'draft' | 'published' | 'archived';

// Enums — PascalCase, values SCREAMING_SNAKE_CASE
enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

// Functions and methods — camelCase, verb-first
function createEntry() {}
function findBySlug() {}
function isPublished() {}
function hasPermission() {}

// Variables — camelCase
const contentEntry = {};
const isLoading = false;
const maxRetries = 3;

// Constants — SCREAMING_SNAKE_CASE
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_LOCALE = 'en';
const CONTENT_QUEUE = 'kast.content';

// Boolean variables — prefix with is/has/can/should
const isPublished = true;
const hasPermission = false;
const canEdit = true;
const shouldRetry = false;
```

### Function Style Rules

```typescript
// ✅ Prefer early returns over nested conditions
async function publishEntry(id: string, userId: string): Promise<ContentEntry> {
  const entry = await this.contentRepository.findById(id);
  if (!entry) throw new NotFoundException(`Entry ${id} not found`);
  if (entry.status === ContentStatus.PUBLISHED) throw new ConflictException('Already published');
  if (!this.canPublish(entry, userId)) throw new ForbiddenException();

  return this.contentRepository.updateStatus(id, ContentStatus.PUBLISHED);
}

// ✅ Pure functions when possible
function buildSeoScore(report: SeoReport): number {
  return report.issues.reduce((score, issue) => score - issue.penalty, 100);
}

// ❌ No magic numbers — use named constants
const size = file.size > 10485760; // ❌
const size = file.size > MAX_FILE_SIZE; // ✅

// ❌ No side effects inside constructors
constructor(private readonly service: ContentService) {
  this.service.loadAll(); // ❌ use OnModuleInit
}
```

### Async/Await Rules

```typescript
// ✅ Always await async calls — never let promises float
await this.contentQueue.add('publish', { entryId });

// ❌ No floating promises
this.contentQueue.add('publish', { entryId }); // ESLint will catch this

// ✅ Use Promise.all for parallel independent calls
const [entry, seoScore] = await Promise.all([
  this.contentRepository.findById(id),
  this.seoService.getScore(id),
]);

// ✅ Proper error handling in async functions
try {
  await this.webhookService.dispatch(event);
} catch (error: unknown) {
  this.logger.error('Webhook dispatch failed', { error, event });
  // Never silently swallow errors
}
```

---

## 10. Import Organization

Imports are **auto-sorted by Prettier** (`prettier-plugin-organize-imports`).

The enforced order:

```typescript
// 1. Node.js built-ins
import { readFileSync } from 'fs';
import path from 'path';

// 2. External packages
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

// 3. Internal monorepo packages
import type { ContentEntry } from '@kast/core';
import { SeoModule } from '@kast/seo';

// 4. Absolute imports (same app, path alias)
import { PrismaService } from '@/prisma/prisma.service';

// 5. Relative imports (closest first)
import { ContentRepository } from './content.repository';
import type { CreateContentDto } from './dto/create-content.dto';
```

**Rules:**

- `import type` for all type-only imports (enforced by ESLint)
- No barrel files (`index.ts`) inside modules — import directly
- Barrel files are only allowed at package root level (`packages/*/src/index.ts`)

---

## 11. Git Workflow

### Branch Naming

```
main              ← production-ready code only
develop           ← integration branch, always shippable

feature/<scope>/<short-description>
fix/<scope>/<short-description>
chore/<short-description>
docs/<short-description>
refactor/<scope>/<short-description>
```

**Examples:**

```
feature/content/add-version-history
feature/seo/live-validation-panel
fix/auth/jwt-refresh-token-expiry
fix/media/s3-upload-timeout
chore/upgrade-nestjs-11
docs/mcp-server-tool-definitions
refactor/content/extract-slug-builder
```

### Branch Rules

- `main` is **protected** — no direct pushes, ever
- `develop` is **protected** — requires PR + review
- Feature branches are cut from `develop`, merged back to `develop`
- Release branches: `release/v1.2.0` cut from `develop`, merged to `main` + `develop`
- Hotfix branches: `hotfix/v1.1.1` cut from `main`, merged to `main` + `develop`

### PR Rules

- PRs must pass: lint + type-check + all tests
- PRs must reference an issue: `Closes #42`
- PR title must follow commit convention (same format)
- Self-review before requesting review
- Squash merge into `develop` — clean history

---

## 12. Commit Convention

Kast uses **Conventional Commits** — enforced by commitlint.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer: BREAKING CHANGE or closes #issue]
```

### Types

| Type       | When to Use                              |
| ---------- | ---------------------------------------- |
| `feat`     | New feature or capability                |
| `fix`      | Bug fix                                  |
| `docs`     | Documentation only                       |
| `style`    | Code style, formatting (no logic change) |
| `refactor` | Code change that is neither feat nor fix |
| `perf`     | Performance improvement                  |
| `test`     | Adding or fixing tests                   |
| `build`    | Build system, dependencies               |
| `ci`       | CI configuration                         |
| `chore`    | Maintenance (no production code change)  |
| `revert`   | Revert a previous commit                 |

### Scopes

Scopes match Kast module names:

```
content, seo, auth, media, mcp, i18n, audit, webhook, queue, plugin
admin, sdk, cli, docs, deps, config
```

### Examples

```bash
feat(content): add version history with diff view
fix(auth): resolve jwt refresh token not rotating
feat(seo): integrate live MCP validation panel
refactor(media): extract S3 upload into storage adapter
docs(mcp): document all tool definitions
chore(deps): upgrade @nestjs/bullmq to 10.2.1
test(content): add unit tests for slug builder
ci: add typecheck step to GitHub Actions

# Breaking change
feat(api)!: rename content entries endpoint

BREAKING CHANGE: /api/v1/entries is now /api/v1/content
```

### Commit Rules

- Subject line: max **72 characters**
- Subject: **imperative mood** ("add", not "added" or "adds")
- Subject: **lowercase** after the colon
- Body: explain **why**, not what (the code shows what)
- No emoji in commit messages — this is not Twitter

---

## 13. Pre-commit Hooks

Managed by **Husky** + **lint-staged** + **commitlint**.

### Setup

```bash
# Install
pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional

# Initialize
npx husky init
```

### `.husky/pre-commit`

```bash
#!/bin/sh
pnpm lint-staged
```

### `.husky/commit-msg`

```bash
#!/bin/sh
npx --no -- commitlint --edit "$1"
```

### `.husky/pre-push`

```bash
#!/bin/sh
pnpm typecheck
pnpm test:unit --passWithNoTests
```

### `lint-staged.config.ts`

```typescript
const config = {
  // TypeScript and JavaScript — lint + fix
  '*.{ts,tsx}': ['eslint --fix --max-warnings 0', 'prettier --write'],
  // JSON, YAML, Markdown — format only
  '*.{json,yml,yaml,md}': ['prettier --write'],
};

export default config;
```

### `commitlint.config.ts`

```typescript
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
        'admin',
        'sdk',
        'cli',
        'docs',
        'deps',
        'config',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 72],
    'body-max-line-length': [2, 'always', 100],
  },
};

export default config;
```

---

## 14. Testing Standards

### Stack

| Layer               | Tool                                     |
| ------------------- | ---------------------------------------- |
| Unit tests          | **Vitest** (packages, utilities)         |
| Unit tests (NestJS) | **Jest** + `@nestjs/testing`             |
| E2E tests (API)     | **Jest** + **Supertest**                 |
| Component tests     | **Vitest** + **React Testing Library**   |
| E2E (browser)       | **Playwright** (v2, out of scope for v1) |

### Coverage Requirements

| Coverage Type       | Minimum                       |
| ------------------- | ----------------------------- |
| Services            | 80%                           |
| Repositories        | 70%                           |
| Controllers         | 60%                           |
| Utilities / helpers | 90%                           |
| DTOs                | Validated by integration test |

### File Structure

Tests live **next to the file they test**:

```
content.service.ts
content.service.spec.ts       ← unit test

content.controller.ts
content.controller.spec.ts    ← unit test

test/
└── content.e2e-spec.ts       ← e2e test (in apps/api/test/)
```

### Unit Test Rules

```typescript
// content.service.spec.ts
describe('ContentService', () => {
  let service: ContentService;
  let repository: jest.Mocked<ContentRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ContentService,
        {
          provide: ContentRepository,
          useValue: {
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ContentService);
    repository = module.get(ContentRepository);
  });

  describe('createEntry', () => {
    it('should create a draft entry with correct defaults', async () => {
      // Arrange
      const dto = { title: 'Hello World', type: 'blog-post' };
      const userId = 'user-123';
      repository.create.mockResolvedValue({ id: 'entry-1', ...dto, status: 'draft' });

      // Act
      const result = await service.createEntry(dto, userId);

      // Assert
      expect(result.status).toBe('draft');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Hello World' }),
      );
    });

    it('should throw NotFoundException when entry does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.publishEntry('missing-id', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
```

**Test rules:**

- Use **AAA pattern**: Arrange / Act / Assert — with comments
- One assertion per `it` block (or tightly related assertions)
- Test names describe behavior: `"should do X when Y"` — not `"test publish"`
- Never test private methods directly — test via public interface
- Mock at the module boundary — not inside the service

---

## 15. Documentation Standards

### JSDoc — When to Use

```typescript
/**
 * Validates an entry against the SEO MCP server and stores the result.
 *
 * @param entryId - The content entry ID to validate
 * @param previewUrl - The URL to run validation against
 * @returns A complete SEO report including score and issue list
 * @throws {NotFoundException} When the entry does not exist
 * @throws {ServiceUnavailableException} When the SEO MCP server is unreachable
 */
async validateEntry(entryId: string, previewUrl: string): Promise<SeoReport> {
  // ...
}
```

**When to write JSDoc:**

- ✅ All public service methods
- ✅ All public types and interfaces in `@kast/core`
- ✅ All plugin SDK interfaces
- ✅ All MCP tool definitions
- ❌ Not on private methods (code should be self-explanatory)
- ❌ Not on controllers (Swagger decorators serve this purpose)

### Swagger (API Docs)

Every controller endpoint must have Swagger decorators:

```typescript
@Post()
@ApiOperation({ summary: 'Create a new content entry' })
@ApiBody({ type: CreateContentDto })
@ApiCreatedResponse({ type: ContentEntryResponseDto })
@ApiBadRequestResponse({ description: 'Validation failed' })
@ApiForbiddenResponse({ description: 'Insufficient role' })
async create(@Body() dto: CreateContentDto): Promise<ContentEntryResponseDto> {
  // ...
}
```

### Inline Comments — When to Use

```typescript
// ✅ Explain WHY, not WHAT
// BullMQ requires the queue name to match the consumer decorator exactly
const CONTENT_QUEUE = 'kast.content';

// ✅ Explain non-obvious decisions
// We use findFirst instead of findUnique because slug uniqueness
// is per-locale, not globally unique (slug + locale = unique)
await this.prisma.contentEntry.findFirst({ where: { slug, locale } });

// ❌ Don't explain what the code obviously does
// Create a new entry ← useless
const entry = await this.contentRepository.create(dto);
```

---

## 16. Environment & Config

### Configuration Rules

Never use `process.env` directly in services or controllers. Always go through a typed config service:

```typescript
// config/app.config.ts
import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  S3_BUCKET: z.string().optional(),
  SEO_MCP_ENDPOINT: z.string().url().optional(),
});

export default registerAs('app', () => {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.toString()}`);
  }
  return parsed.data;
});
```

**Rules:**

- All env vars are validated on startup with Zod — app refuses to start with invalid config
- `.env` files are never committed — `.env.example` always is
- Secrets never appear in logs — use redacted logging

### `.env.example` (committed)

```bash
# App
NODE_ENV=development
PORT=3001

# Database
DATABASE_URL=postgresql://kast:password@localhost:5432/kast_db

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-super-secret-key-minimum-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key-minimum-32-chars

# Storage (optional — defaults to local FS)
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=

# SEO MCP (optional — enables live SEO validation)
SEO_MCP_ENDPOINT=
```

---

## 17. Error Handling

### NestJS Exceptions

Always use NestJS built-in exceptions — never throw raw `Error`:

```typescript
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
  ServiceUnavailableException,
} from '@nestjs/common';

// ✅ Correct
throw new NotFoundException(`Content entry ${id} not found`);
throw new ForbiddenException('Insufficient permissions to publish');
throw new ConflictException('Slug already exists in this locale');

// ❌ Wrong
throw new Error('not found');
throw 'not found';
```

### Global Exception Filter

All unhandled errors go through a global filter that:

- Logs the error with structured metadata
- Returns a consistent error shape
- Never leaks stack traces in production

```typescript
// Standard error response shape
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Content entry abc123 not found",
  "timestamp": "2026-04-15T10:00:00.000Z",
  "path": "/api/v1/content/abc123"
}
```

### Logging Rules

```typescript
// Use NestJS Logger — never console.log in production code
private readonly logger = new Logger(ContentService.name);

// ✅ Structured logging with context
this.logger.log('Publishing content entry', { entryId, userId });
this.logger.warn('SEO score below threshold', { entryId, score });
this.logger.error('Failed to dispatch webhook', { webhookId, error: err.message });

// ❌ Never log sensitive data
this.logger.log('User logged in', { password }); // ❌ NEVER
this.logger.log('JWT token', { token }); // ❌ NEVER
```

---

## 18. Tooling Summary

### Dev Dependencies (root)

```json
{
  "devDependencies": {
    "typescript": "^5.5.0",
    "eslint": "^9.0.0",
    "typescript-eslint": "^8.0.0",
    "@next/eslint-plugin-next": "latest",
    "eslint-plugin-react": "^7.35.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "prettier": "^3.3.0",
    "prettier-plugin-organize-imports": "^4.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "turbo": "^2.0.0"
  }
}
```

### Root `package.json` Scripts

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "lint:fix": "turbo run lint:fix",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky"
  }
}
```

### CI Pipeline (GitHub Actions)

Every PR runs this pipeline — all must pass:

```
1. pnpm install (cached)
2. pnpm format:check        ← Prettier
3. pnpm lint                ← ESLint (zero warnings allowed)
4. pnpm typecheck           ← TypeScript strict
5. pnpm test                ← Unit tests
6. pnpm build               ← Builds all packages
```

E2E tests run on merge to `develop` only (not every PR).

---

## Quick Reference Card

```
TypeScript:    strict: true + 7 additional flags, never any, never @ts-ignore
ESLint:        Flat config v9, zero warnings policy, max-lines enforced
Prettier:      100 chars, single quotes, trailing commas, auto import sort
File naming:   kebab-case folders, kebab-case.type.ts files, PascalCase components
File limits:   300 lines max (services), 200 (controllers), 50 lines per function
Commits:       Conventional Commits, enforced by commitlint + husky
Branches:      feature/<scope>/<name>, protected main + develop
Testing:       AAA pattern, 80% service coverage, tests next to source
Logging:       NestJS Logger only, structured, no secrets, no console.log
Config:        Zod-validated on startup, no raw process.env in services
Errors:        NestJS exceptions only, global filter, consistent shape
```

---

_Document version: 0.1_
_Last updated: April 2026_
_Status: Enforced from day one — no exceptions_
