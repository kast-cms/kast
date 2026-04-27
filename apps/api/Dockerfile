# ── Stage 1: install deps ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile --filter @kast/api...

# ── Stage 2: generate prisma + build ──────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN pnpm --filter @kast/plugin-sdk run build && \
    pnpm --filter @kast/api run prisma:generate && \
    pnpm --filter @kast/api run build

# ── Stage 3: production image ──────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HUSKY=0
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/ ./packages/
COPY apps/api/prisma ./apps/api/prisma
RUN pnpm install --frozen-lockfile --filter @kast/api... --prod && \
    pnpm --filter @kast/api run prisma:generate
COPY --from=builder /app/apps/api/dist ./apps/api/dist
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
