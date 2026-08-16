# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

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

- **Authentication**: JWT with 15-minute access tokens, separate refresh secrets, and refresh-token rotation. OAuth flows validate state and verified provider email addresses.
- **Authorization**: Role and permission checks are deny-by-default. API and agent token scopes are enforced independently of their owner's permissions.
- **Transport**: HSTS with preload, strict CSP, `X-Content-Type-Options`, `Referrer-Policy`.
- **Input validation**: DTOs are validated with unknown-field rejection. Rich text is sanitized with DOMPurify before storage, and uploads are checked against both their declared MIME type and magic bytes.
- **Outbound requests**: Remote media imports and webhooks use bounded redirects, DNS revalidation, response-size limits, and private/reserved-address blocking. Plugins are trusted in-process code and are not constrained by this guard.
- **Rate limiting**: The API has a global limit plus stricter limits for login, setup, password recovery, and public form submission.
- **Cryptography**: Passwords use Argon2id. API, agent, refresh, and recovery tokens are stored as hashes. Stored application and plugin secrets use authenticated encryption.
- **Audit trail**: Protected management mutations, authorization denials, and MCP tool calls are recorded in the audit log.
- **Dependencies and analysis**: CI audits production dependencies, Dependabot checks the full lockfile, and CodeQL scans JavaScript and TypeScript.
- **Plugins**: Plugins are trusted build-time extensions loaded into the API process. Install only source you would be willing to run as part of the application itself.

## OWASP Top 10 Mitigation Summary

| OWASP ID | Vulnerability             | Kast Mitigation                                                               |
| -------- | ------------------------- | ----------------------------------------------------------------------------- |
| A01      | Broken Access Control     | Deny-by-default route permissions; scoped API and agent tokens                |
| A02      | Cryptographic Failures    | Argon2id passwords; hashed opaque tokens; authenticated secret encryption     |
| A03      | Injection                 | Prisma parameterization; rich-text sanitization; strict DTO validation        |
| A04      | Insecure Design           | Recoverable deletion, publish gates, and permission-aware previews            |
| A05      | Security Misconfiguration | Helmet/CSP, validated environment, startup checks, and no default secrets     |
| A06      | Vulnerable Components     | CI dependency audit, Dependabot, lockfile overrides, and CodeQL               |
| A07      | Auth Failures             | Endpoint rate limits, refresh rotation, OAuth state, and setup locking        |
| A08      | Software/Data Integrity   | HMAC-signed webhooks and explicit trusted-plugin deployment model             |
| A09      | Logging & Monitoring      | Mutation, denial, failure, and agent-tool audit records                       |
| A10      | SSRF                      | DNS/IP validation, redirect revalidation, and bounded outbound response reads |

## Bug Bounty

We do not currently operate a paid bug bounty programme. We do publicly credit reporters in release notes (with their consent).
