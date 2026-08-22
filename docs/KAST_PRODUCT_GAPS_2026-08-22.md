# Kast CMS — Product Gap Register (Post-Remediation)

**Date:** 2026-08-22
**Context:** written after the security-alert cleanup (#77, #78) and the dependency
PRs (#73–#75, #79) landed on `main`. The 2026-08-10 full audit's P0 spine and the
`KAST_OPEN_FINDINGS.md` register are closed; what follows are the *product-level*
gaps that remain — depth, not plumbing. Ordered by adoption impact.

---

## 1. Trust & access — the most common "can we adopt this" blocker

- **No 2FA/MFA** — nothing in the schema, no TOTP anywhere. For a CMS holding
  editorial access, this is table stakes.
- **SSO is GitHub/Google only** — no generic OIDC/SAML connector, which locks out
  orgs using Entra/Okta.
- **No session management UI** — refresh tokens exist, but admins can't see/revoke
  their active sessions.

## 2. Content interoperability — the adoption blocker

- **No export/import** — there's no full-content JSON backup/restore, and no
  migrators (WordPress/Strapi/Contentful). Getting data in is currently "write
  against the SDK".
- **Cache invalidation story** — publish webhooks exist, but there's no documented
  purge/revalidate path for Vercel/Fastly/CDN fronts, which every serious delivery
  setup needs.

## 3. Editorial workflow depth

- Versions are stored (`ContentEntryVersion`) but there's no review/approval flow
  (submit → review → approve with role gates) and likely no concurrent-edit
  protection — two editors can silently clobber each other.
- Version diff and restore UI — the data is there; the experience isn't.
- Scheduled publishing has the field and the publish module — worth an
  end-to-end verification, since the only cron findable in code is the trash
  scheduler.

## 4. Media renditions

`sharp` is there, usage tracking is there, but no named size variants, no focal
point, no on-delivery transforms. Every mature CMS has this; it's also the
biggest lever on frontend performance.

## 5. Observability & DR honesty

Sentry plugin and health checks exist, but no metrics endpoint (Prometheus/OTel).
More importantly, the register says it outright: failover/restore claims in
`docs/ops/` are reasoned from code, never exercised — the drill schedule exists
but hasn't run.

## 6. Accepted-by-decision gaps

Documented, not defects: plugins are build-time trusted code — no artifact
installation, isolation, or plugin-supplied UI until third-party demand;
single-tenant by design (no workspaces/teams — worth revisiting if targeting
agencies). See `KAST_OPEN_FINDINGS.md` §1 for the recorded reasoning.

## 7. Engineering debt — the held dependency majors

Held back during the 2026-08-21 production-dependencies merge (#79), each a real
migration with CI as the acceptance gate:

- Prisma 7 (schema `url` removal, config + client adapters)
- TypeScript 7 (ts-jest / plugin-sdk still need the classic compiler API)
- Next 16.3 (its `@swc/helpers` 0.5.23 pairing breaks the admin Docker stage)
- @clack/prompts 1 (prompt results became optional)
- zod 4 in admin (`ZodError.errors` → `issues`)
- The NestJS majors (@nestjs/passport, jwt, swagger, terminus, bullmq, config),
  bull-board 9, ioredis 6, lucide-react 1, tailwind-merge 3, execa 10, shiki 4,
  semantic-release 25

---

**Suggested ordering for the next month:** 2FA + generic OIDC → export/import +
a WordPress migrator → review workflow + edit locking → media variants.
