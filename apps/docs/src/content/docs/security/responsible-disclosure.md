---
title: Responsible Disclosure
description: How to report security vulnerabilities in Kast CMS.
sidebar:
  order: 4
---

We take security seriously. If you discover a vulnerability in Kast, please report it privately before disclosing it publicly.

## How to report

**Preferred: GitHub Security Advisories**

Open a private advisory at:
[https://github.com/kast-cms/kast/security/advisories/new](https://github.com/kast-cms/kast/security/advisories/new)

**Alternative: email**

Send details to **security@kast.dev** with subject line `[SECURITY] <brief description>`.

## What to include

- Description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept (if applicable)
- Affected version(s)
- Any suggested mitigation or fix

## What to expect

| Timeline               | Action                                    |
| ---------------------- | ----------------------------------------- |
| 48 hours               | Acknowledgement of your report            |
| 5 business days        | Assessment and planned fix timeline       |
| ≤ 14 days for critical | Patch released and coordinated disclosure |

We follow responsible disclosure — please give us reasonable time to patch before making any public disclosure.

## OWASP Top 10 mitigations

Kast addresses each OWASP Top 10 category:

| OWASP ID | Vulnerability             | Kast mitigation                                                                 |
| -------- | ------------------------- | ------------------------------------------------------------------------------- |
| A01      | Broken Access Control     | `RbacGuard` + `@RequirePermission` on every endpoint                            |
| A02      | Cryptographic Failures    | bcrypt(12) passwords; SHA-256 token hashes; AES-256-GCM plugin config           |
| A03      | Injection                 | Prisma parameterized queries; DOMPurify rich text; `whitelist: true` DTOs       |
| A04      | Insecure Design           | Soft delete; append-only audit log; least-privilege RBAC                        |
| A05      | Security Misconfiguration | Helmet + CSP; env validated at startup; no default secrets                      |
| A06      | Vulnerable Components     | `pnpm audit` in CI; Dependabot weekly updates                                   |
| A07      | Auth Failures             | Rate limiting (20 req / 15 min); JWT rotation; no username enumeration on reset |
| A08      | Software & Data Integrity | Plugin manifest verification; HMAC webhook signing; no `eval`                   |
| A09      | Logging & Monitoring      | Audit interceptor on all mutations; structured JSON logs                        |
| A10      | SSRF                      | Plugin network allowlist; no user-controlled URL fetch in core                  |

## Bug bounty

We do not currently operate a paid bug bounty programme. We do publicly credit reporters in release notes (with their consent).

## Supported versions

| Version | Security fixes     |
| ------- | ------------------ |
| 0.x     | Yes — latest patch |
