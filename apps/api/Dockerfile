# ── Stage 1: install deps ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile --filter @kast/api...

# ── Stage 2: build + generate prisma ──────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN pnpm --filter @kast/plugin-sdk run build && \
    pnpm --filter @kast/api run prisma:generate && \
    pnpm --filter @kast/api run build

# ── Stage 3: prune to prod-only deploy bundle ──────────────────────────────────
FROM builder AS deployer
RUN pnpm deploy --filter @kast/api --prod /deploy

# ── Stage 4: production image ──────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deployer /deploy .
COPY --from=builder /app/apps/api/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
