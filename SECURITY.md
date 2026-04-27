# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a vulnerability in Kast, please report it **privately** before disclosing it publicly.

### How to Report

1. **GitHub Security Advisories (preferred)**  
   Open a private advisory at:  
   [https://github.com/kast-cms/kast/security/advisories/new](https://github.com/kast-cms/kast/security/advisories/new)

2. **Email**  
   Send details to **security@kast.dev** with the subject line `[SECURITY] <brief description>`.

Please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce or a proof-of-concept (if applicable).
- The affected version(s).
- Any suggested mitigation or fix.

### What to Expect

- **Acknowledgement**: within 48 hours.
- **Status update**: within 5 business days with our assessment and planned timeline.
- **Fix and disclosure**: we aim to patch critical vulnerabilities within 14 days and coordinate public disclosure with the reporter.

We follow **responsible disclosure** — please give us reasonable time to patch before making any public disclosure.

## Security Features

Kast implements multiple layers of security:

- **Authentication**: JWT with 15-minute access tokens, separate refresh secrets, and token rotation on every refresh. OAuth CSRF state validation.
- **Authorization**: Role-based access control (RBAC) with `SUPER_ADMIN`, `ADMIN`, `EDITOR`, and `VIEWER` roles. Every protected endpoint requires explicit permission.
- **Transport**: HSTS with preload, strict CSP, `X-Content-Type-Options`, `Referrer-Policy`.
- **Input validation**: All DTOs use `whitelist: true` with `forbidNonWhitelisted`. Rich text fields are sanitized with DOMPurify before storage (OWASP A03). File uploads are validated against both declared MIME type and magic bytes.
- **Rate limiting**: Auth endpoints are rate-limited to 20 requests / 15 minutes. Form submissions to 10 requests / minute per IP.
- **Cryptography**: Passwords hashed with bcrypt (cost factor 12). API/agent tokens stored as SHA-256 hashes. Plugin configuration encrypted with AES-256-GCM.
- **Audit trail**: Every mutation is logged to an append-only audit log.
- **Dependencies**: Automated `pnpm audit` in CI and weekly Dependabot updates.

## OWASP Top 10 Mitigation Summary

| OWASP ID | Vulnerability             | Kast Mitigation                                                           |
| -------- | ------------------------- | ------------------------------------------------------------------------- |
| A01      | Broken Access Control     | `RbacGuard` + `@RequirePermission` on every endpoint                      |
| A02      | Cryptographic Failures    | bcrypt(12) passwords; SHA-256 token hashes; AES-256-GCM plugin config     |
| A03      | Injection                 | Prisma parameterized queries; DOMPurify rich text; `whitelist: true` DTOs |
| A04      | Insecure Design           | Soft delete; append-only audit log; least-privilege RBAC                  |
| A05      | Security Misconfiguration | Helmet + CSP; env validated at startup; no default secrets                |
| A06      | Vulnerable Components     | `pnpm audit` in CI; Dependabot weekly updates                             |
| A07      | Auth Failures             | Rate limiting (20/15 min); JWT rotation; no username enumeration on reset |
| A08      | Software/Data Integrity   | Plugin manifest verification; HMAC webhook signing; no `eval`             |
| A09      | Logging & Monitoring      | Audit interceptor on all mutations; structured JSON logs                  |
| A10      | SSRF                      | Plugin network allowlist; no user-controlled URL fetch in core            |

## Bug Bounty

We do not currently operate a paid bug bounty programme. We do publicly credit reporters in release notes (with their consent).
