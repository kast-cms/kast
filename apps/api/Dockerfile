# syntax=docker/dockerfile:1

# ── Stage 1: install deps (full api subgraph, incl. dev deps for building) ──────
FROM node:20-alpine AS deps
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# pnpm version is taken from the root package.json "packageManager" field.
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile --filter @kast-cms/api...

# ── Stage 2: build plugin-sdk, generate Prisma client, build the API ───────────
FROM deps AS builder
COPY . .
RUN pnpm --filter @kast-cms/plugin-sdk run build \
 && pnpm --filter @kast-cms/api run prisma:generate \
 && pnpm --filter @kast-cms/api run build

# ── Stage 3: prune to a prod-only deploy bundle, then regenerate the client ─────
# `pnpm deploy --prod` rebuilds node_modules from the store, which drops the
# Prisma client generated into the dev node_modules in stage 2. Regenerate it
# inside the pruned bundle so the runtime image can initialize PrismaClient.
# `prisma` is a production dependency, so the CLI survives the prune (and is
# also available at runtime for `prisma migrate deploy`).
FROM builder AS deployer
RUN pnpm deploy --filter @kast-cms/api --prod /deploy \
 && cd /deploy \
 && node_modules/.bin/prisma generate

# ── Stage 4: production image ──────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# The deploy bundle carries prod node_modules (with the generated Prisma client),
# the Prisma schema + migrations, and the prisma CLI. dist is copied explicitly
# to guarantee the compiled output is present.
COPY --from=deployer /deploy .
COPY --from=builder /app/apps/api/dist ./dist
EXPOSE 3000
# Apply pending migrations before starting so Docker Compose boots a usable API.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
