# KAST CMS — Security Model

### _Who can do what. How it's enforced. No gaps._

> Version: 0.1 | April 2026

---

## Table of Contents

1. [Security Principles](#1-security-principles)
2. [HTTP Security Headers](#2-http-security-headers)
3. [Authentication Architecture](#3-authentication-architecture)
4. [Token Design](#4-token-design)
5. [Role-Based Access Control (RBAC)](#5-role-based-access-control-rbac)
6. [Full Permission Matrix](#6-full-permission-matrix)
7. [Field-Level Permissions](#7-field-level-permissions)
8. [Content-Type Scoped Permissions](#8-content-type-scoped-permissions)
9. [Agent Token Scopes (MCP)](#9-agent-token-scopes-mcp)
10. [Plugin Permission Model](#10-plugin-permission-model)
11. [Data Security](#11-data-security)
12. [Input Validation](#12-input-validation)
13. [Audit Trail](#13-audit-trail)
14. [NestJS Implementation](#14-nestjs-implementation)
15. [Security Checklist](#15-security-checklist)

---

## 1. Security Principles

Every security decision in Kast follows these six rules. If a new feature conflicts with any of them, the feature changes — not the rules.

### 1. Secure by default

Every setting starts in the most restrictive state. Developers opt into openness, not into security. CORS is locked down. Rate limiting is always on. Plugins are denied all access until explicitly granted.

### 2. Least privilege everywhere

No role, token, or plugin gets more access than it needs to do its job. VIEWER cannot write. EDITOR cannot manage users. Plugins declare exactly what they need in their manifest — nothing else is granted.

### 3. Secrets are never stored in plain text

API tokens, agent tokens, refresh tokens, OAuth access tokens, and webhook signing secrets are stored as hashes. The plain value is shown exactly once at creation. If the database leaks, these values are useless.

### 4. Every mutation is audited

Every create, update, delete, publish, login, token creation, plugin install, and schema change writes an immutable audit log entry. Agent actions are tagged with the agent ID. Dry-run MCP operations are also logged and flagged.

### 5. Defense in depth

Security is not a single guard. It is layered: HTTP headers → CORS → rate limiting → authentication → authorization → field-level checks → input validation. Every layer must pass independently.

### 6. Plugins are trusted code, and must be treated as such

Plugins are **not** sandboxed. They are `require()`d into the API process and run with full Node.js capability: `process.env`, the filesystem, and the network are all reachable from plugin code regardless of what its manifest declares.

The `permissions` array is a compatibility declaration. The loader refuses to load a plugin requesting a permission it does not recognise, and skips a plugin whose module fails to load, so a bad plugin cannot silently take the API down. Neither check constrains what a loaded plugin then does.

Consequently a plugin is inside every trust boundary this document describes. Operators must treat installing one as equivalent to merging its source: only bundle plugins you would run as your own code. Plugins reach the deployment by being present at build time — there is no registry fetch and no artifact verification to rely on.

Real isolation (worker threads or a subprocess with a serialised context API) is not implemented. Until it is, no statement in this document about authorization, secret handling, or data access should be read as holding against plugin code.

---

## 2. HTTP Security Headers

Applied globally via NestJS middleware. Cannot be disabled.

```typescript
// main.ts — applied before any route handler
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // needed for admin UI
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xContentTypeOptions: true, // X-Content-Type-Options: nosniff
    xFrameOptions: 'DENY', // X-Frame-Options: DENY
    xXssProtection: false, // deprecated — CSP handles this
    crossOriginEmbedderPolicy: false, // disabled for media delivery
  }),
);
```

### Header Summary

| Header                      | Value                                          | Why                                     |
| --------------------------- | ---------------------------------------------- | --------------------------------------- |
| `Content-Security-Policy`   | Strict directives                              | Prevents XSS, clickjacking, injection   |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS, no downgrade attacks      |
| `X-Content-Type-Options`    | `nosniff`                                      | Prevents MIME sniffing attacks          |
| `X-Frame-Options`           | `DENY`                                         | Prevents clickjacking via iframes       |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | Limits referrer data leakage            |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`     | Restricts browser API access            |
| `Cache-Control`             | `no-store` on auth endpoints                   | Prevents caching of sensitive responses |

---

## 3. Authentication Architecture

Kast uses a **stateless JWT + refresh token rotation** pattern. No server-side session state.

### Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Authentication Flow                        │
│                                                              │
│  1. POST /auth/login                                         │
│     email + password                                         │
│            ↓                                                 │
│     [Argon2id verify password]                               │
│            ↓                                                 │
│     Issue: accessToken (JWT, 15min)                          │
│            + refreshToken (opaque, 30 days, stored as hash)  │
│                                                              │
│  2. API requests                                             │
│     Authorization: Bearer <accessToken>                      │
│            ↓                                                 │
│     [verify JWT signature + expiry]                          │
│     [extract userId + roles from payload]                    │
│     [run RBAC guard]                                         │
│                                                              │
│  3. Token expired → POST /auth/refresh                       │
│     { refreshToken }                                         │
│            ↓                                                 │
│     [hash token → lookup in DB]                              │
│     [verify not revoked, not expired]                        │
│     [rotate: revoke old, issue new pair]                     │
│                                                              │
│  4. Logout → POST /auth/logout                               │
│     [mark refreshToken as revoked in DB]                     │
│     [accessToken expires naturally — no server-side revoke]  │
└──────────────────────────────────────────────────────────────┘
```

### JWT Payload

```typescript
interface JwtPayload {
  sub: string; // userId
  email: string;
  roles: string[]; // ["ADMIN", "EDITOR"]
  iat: number; // issued at
  exp: number; // expires at (15 min from iat)
  jti: string; // unique JWT ID (for future revocation if needed)
}
```

**JWT is signed with `HS256` using `JWT_SECRET` (min 32 chars, validated on startup).**
**Refresh token is signed with a separate `JWT_REFRESH_SECRET`.**

### Token Lifetimes

| Token                         | Lifetime                    | Storage                                        |
| ----------------------------- | --------------------------- | ---------------------------------------------- |
| Access token (JWT)            | 15 minutes                  | Client memory only — never localStorage        |
| Refresh token                 | 30 days                     | HttpOnly cookie or client storage — hash in DB |
| API token (`kast_...`)        | Configurable or never       | Client — hash in DB                            |
| Agent token (`kastagent_...`) | No expiry (revoke manually) | Client — hash in DB                            |

### MFA

Users can enable TOTP MFA from the admin security settings. The encrypted TOTP
secret is stored on the user row, and recovery codes are stored as Argon2id
hashes. Once enabled, password and OAuth/OIDC login first issue a short-lived
opaque MFA challenge, then mint the normal token pair only after a valid TOTP or
unused recovery code.

### OAuth / OIDC Flow

```
User clicks "Login with Google, GitHub, or configured OIDC"
        ↓
GET /auth/oauth/:provider → redirect to provider
        ↓
Provider redirects to /auth/oauth/:provider/callback
        ↓
[find or create User by email + OAuthAccount record]
        ↓
Issue same MFA challenge or accessToken + refreshToken pair as password login
```

Google and GitHub use the provider strategy. Generic OIDC is configured with
`OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_AUTHORIZATION_URL`,
`OIDC_TOKEN_URL`, `OIDC_USERINFO_URL`, and optional `OIDC_SCOPES`.

OAuth does not create separate session types. All flows converge on the same JWT
and refresh-token session rows. The admin can list active sessions and revoke one
or all refresh tokens for the current account.

---

## 4. Token Design

### API Tokens (`kast_...`)

Used by SDKs, server-side scripts, CI/CD pipelines, and frontends that use `X-Kast-Key`.

```
Format:    kast_<random_32_chars>
Example:   kast_x8j2mQpL9vRcYnKoA7wZtBsD3hFgEiNu
Stored:    SHA-256 hash only
Displayed: prefix (first 8 chars) in UI: "kast_x8j2..."
           Full token shown ONCE at creation
```

**Scope types:**

| Scope         | Access                                                   |
| ------------- | -------------------------------------------------------- |
| `READ_ONLY`   | All `GET` endpoints only. No mutations.                  |
| `FULL_ACCESS` | All endpoints the creating user has access to            |
| `SCOPED`      | Explicit per-resource, per-action grants via `scopeData` |

**`SCOPED` example:**

```json
{
  "scope": "SCOPED",
  "scopeData": {
    "content:*": ["read", "create", "update"],
    "content:articles": ["publish"],
    "media": ["read", "upload"],
    "seo": ["read"]
  }
}
```

Content routes carry the content-type slug as a scope, so content grants are
keyed `content:<type>` or `content:*`. A bare `content` key only matches
content routes that carry no type scope — it deliberately does **not** widen
to every content type, so a token minted before a type existed never gains
access to it silently.

**Enforcement** happens in `TokenPolicyGuard`, which runs between
`JwtAuthGuard` and `RolesGuard`. `resource` and `action` are derived from the
route itself (`common/authorization/route-permission.util.ts`), so no
controller needs a decorator.

The policy is **fail-closed**, with consequences worth stating explicitly:

- A missing or unrecognised scope is denied (`403 TOKEN_SCOPE_UNKNOWN`), not
  allowed.
- A route whose resource/action cannot be derived is denied
  (`403 TOKEN_SCOPE_UNRESOLVED`).
- **Sub-action verbs override the method-derived action.** `POST
/content-types/:slug/entries/:id/publish` is `content:publish`, not
  `content:create` — a token granted `content: ["create"]` cannot publish.
- **A batched route requires what its single-entry equivalent requires.** `POST
/content-types/:slug/entries/bulk/trash` is `content:delete` — the same
  permission as `DELETE /content-types/:slug/entries/:id` — because the verb is
  aliased to the action it performs, not to the HTTP method. Without that
  aliasing it derived `content:create`, so a token granted `content: ["create"]`
  could soft-delete up to 100 entries per request while being refused the
  single-entry delete. Likewise `POST /content-types/:slug/entries/:id/unarchive`
  is `content:restore`, matching its deprecated `:id/restore` alias.
- A `bulk/<verb>` route whose verb maps to no known action is denied
  (`403 TOKEN_SCOPE_UNRESOLVED`) rather than falling back to the method.
- The MCP transport is itself a resource: a `SCOPED` token needs
  `mcp: ["create"]` to `POST /api/v1/mcp`.
- **Expired tokens are rejected with 401.** Expiry is enforced both in the
  query and in the strategy.

`*` is honoured as a wildcard on either side (`"*": ["read"]`, or
`"content": ["*"]`).

---

### Agent Tokens (`kastagent_...`)

Used exclusively by AI agents connecting via the MCP server.

```
Format:    kastagent_<random_32_chars>
Example:   kastagent_pQ4rNmKj7vXzWsBcYhLtEoAf2DgIu9Rs
Stored:    SHA-256 hash only
Displayed: prefix (first 8 chars) in UI
           Full token shown ONCE at creation
```

Agent token scope is a **flat array of MCP tool names** — not a
resource→actions object. A tool call is permitted only when its exact name
appears in the array (`McpService.isAgentTokenScopeAllowed`):

```json
["list_content_entries", "get_content_entry", "create_content_entry", "publish_content_entry"]
```

An empty array = **no tools**. An omitted tool name = **no access** to that
tool.

Agent tokens are additionally confined to the MCP transport: `TokenPolicyGuard`
rejects any request carrying an agent token whose route is not under
`/api/v1/mcp` with `403 AGENT_TOKEN_NOT_ALLOWED`. An agent token therefore
cannot read settings, list content, or manage its own credential over REST.

Every agent request also writes an `AgentSession` record — which tools were called and when.

---

### Token Validation Flow (NestJS Guard)

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException();

    // Route to correct validator based on prefix
    if (token.startsWith('kastagent_')) {
      return this.validateAgentToken(token, request);
    }
    if (token.startsWith('kast_')) {
      return this.validateApiToken(token, request);
    }
    // Default: JWT
    return this.validateJwt(token, request);
  }

  private extractToken(request: Request): string | null {
    const auth = request.headers['authorization'];
    if (auth?.startsWith('Bearer ')) return auth.slice(7);

    // X-Kast-Key only accepted on delivery endpoints
    const kastKey = request.headers['x-kast-key'];
    if (kastKey && request.path.startsWith('/api/v1/delivery')) {
      return kastKey as string;
    }

    return null;
  }
}
```

---

## 5. Role-Based Access Control (RBAC)

### System Roles (cannot be deleted or modified)

| Role          | Description                                                                               | Who Gets It               |
| ------------- | ----------------------------------------------------------------------------------------- | ------------------------- |
| `SUPER_ADMIN` | Unrestricted access. Can manage all roles including other admins. Can permanently delete. | Installation creator only |
| `ADMIN`       | Full access except cannot modify SUPER_ADMIN accounts or permanently delete.              | Trusted team leads        |
| `EDITOR`      | Create and manage content, media, SEO. Cannot manage users, roles, or system config.      | Content creators          |
| `VIEWER`      | Read-only access to content, media, and SEO. No mutations.                                | Clients, stakeholders     |

### Custom Roles

`ADMIN` and `SUPER_ADMIN` can create custom roles by combining individual permissions from the permission matrix below. Custom roles cannot exceed the permissions of the creator's role (privilege escalation prevention).

```typescript
// Creating a "Content Manager" custom role
POST /api/v1/roles
{
  "name": "content-manager",
  "displayName": "Content Manager",
  "permissions": [
    { "resource": "content", "action": "read", "scope": "*" },
    { "resource": "content", "action": "create", "scope": "*" },
    { "resource": "content", "action": "update", "scope": "*" },
    { "resource": "content", "action": "delete", "scope": "blog-post" },
    { "resource": "media", "action": "read", "scope": "*" },
    { "resource": "media", "action": "upload", "scope": "*" }
  ]
}
```

---

## 6. Full Permission Matrix

### Resources and Actions

| Resource        | Actions                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `content`       | `read` `create` `update` `delete` `publish` `unpublish` `schedule` `restore` `version.revert`      |
| `content-types` | `read` `create` `update` `delete` `field.create` `field.update` `field.delete`                     |
| `media`         | `read` `upload` `update` `delete` `restore` `folder.create` `folder.update` `folder.delete`        |
| `seo`           | `read` `update` `validate` `redirect.create` `redirect.update` `redirect.delete` `redirect.import` |
| `users`         | `read` `create` `update` `delete` `restore`                                                        |
| `roles`         | `read` `create` `update` `delete` `permission.assign`                                              |
| `tokens`        | `read` `create` `revoke`                                                                           |
| `agent-tokens`  | `read` `create` `revoke` `session.read`                                                            |
| `webhooks`      | `read` `create` `update` `delete` `test` `delivery.read`                                           |
| `plugins`       | `read` `install` `enable` `disable` `uninstall` `config.read` `config.update`                      |
| `forms`         | `read` `create` `update` `delete` `restore` `submission.read` `submission.mark-read`               |
| `menus`         | `read` `create` `update` `delete` `item.create` `item.update` `item.delete`                        |
| `settings`      | `read` `update`                                                                                    |
| `locales`       | `read` `create` `update` `delete`                                                                  |
| `audit`         | `read` `export`                                                                                    |
| `trash`         | `read` `restore` `permanent-delete`                                                                |

---

### Role × Permission Matrix

✅ = Allowed | ❌ = Denied | ⚠️ = Allowed with restrictions (see notes)

#### Content

| Action                         | VIEWER | EDITOR | ADMIN | SUPER_ADMIN |
| ------------------------------ | ------ | ------ | ----- | ----------- |
| `content.read`                 | ✅     | ✅     | ✅    | ✅          |
| `content.create`               | ❌     | ✅     | ✅    | ✅          |
| `content.update`               | ❌     | ✅     | ✅    | ✅          |
| `content.delete` (→ trash)     | ❌     | ✅     | ✅    | ✅          |
| `content.publish`              | ❌     | ✅     | ✅    | ✅          |
| `content.unpublish`            | ❌     | ✅     | ✅    | ✅          |
| `content.schedule`             | ❌     | ✅     | ✅    | ✅          |
| `content.restore` (from trash) | ❌     | ❌     | ✅    | ✅          |
| `content.version.revert`       | ❌     | ✅     | ✅    | ✅          |

#### Content Types (Schema)

| Action                       | VIEWER | EDITOR | ADMIN | SUPER_ADMIN |
| ---------------------------- | ------ | ------ | ----- | ----------- |
| `content-types.read`         | ✅     | ✅     | ✅    | ✅          |
| `content-types.create`       | ❌     | ❌     | ✅    | ✅          |
| `content-types.update`       | ❌     | ❌     | ✅    | ✅          |
| `content-types.delete`       | ❌     | ❌     | ❌    | ✅          |
| `content-types.field.create` | ❌     | ❌     | ✅    | ✅          |
| `content-types.field.update` | ❌     | ❌     | ✅    | ✅          |
| `content-types.field.delete` | ❌     | ❌     | ✅    | ✅          |

#### Media

| Action                            | VIEWER | EDITOR | ADMIN | SUPER_ADMIN |
| --------------------------------- | ------ | ------ | ----- | ----------- |
| `media.read`                      | ✅     | ✅     | ✅    | ✅          |
| `media.upload`                    | ❌     | ✅     | ✅    | ✅          |
| `media.update` (alt text, folder) | ❌     | ✅     | ✅    | ✅          |
| `media.delete` (→ trash)          | ❌     | ✅     | ✅    | ✅          |
| `media.restore` (from trash)      | ❌     | ❌     | ✅    | ✅          |
| `media.folder.create`             | ❌     | ✅     | ✅    | ✅          |
| `media.folder.update`             | ❌     | ✅     | ✅    | ✅          |
| `media.folder.delete`             | ❌     | ❌     | ✅    | ✅          |

#### SEO

| Action                       | VIEWER | EDITOR | ADMIN | SUPER_ADMIN |
| ---------------------------- | ------ | ------ | ----- | ----------- |
| `seo.read`                   | ✅     | ✅     | ✅    | ✅          |
| `seo.update` (meta fields)   | ❌     | ✅     | ✅    | ✅          |
| `seo.validate` (trigger MCP) | ❌     | ✅     | ✅    | ✅          |
| `seo.redirect.create`        | ❌     | ❌     | ✅    | ✅          |
| `seo.redirect.update`        | ❌     | ❌     | ✅    | ✅          |
| `seo.redirect.delete`        | ❌     | ❌     | ✅    | ✅          |
| `seo.redirect.import`        | ❌     | ❌     | ✅    | ✅          |

#### Users

| Action                       | VIEWER | EDITOR | ADMIN | SUPER_ADMIN |
| ---------------------------- | ------ | ------ | ----- | ----------- |
| `users.read`                 | ❌     | ❌     | ✅    | ✅          |
| `users.create`               | ❌     | ❌     | ✅    | ✅          |
| `users.update`               | ❌     | ❌     | ⚠️    | ✅          |
| `users.delete` (→ trash)     | ❌     | ❌     | ⚠️    | ✅          |
| `users.restore` (from trash) | ❌     | ❌     | ✅    | ✅          |

> ⚠️ `ADMIN` cannot update or trash other `ADMIN` or `SUPER_ADMIN` accounts. Only `SUPER_ADMIN` can modify accounts at equal or higher privilege.

#### Roles & Permissions

| Action                       | VIEWER | EDITOR | ADMIN | SUPER_ADMIN |
| ---------------------------- | ------ | ------ | ----- | ----------- |
| `roles.read`                 | ❌     | ❌     | ✅    | ✅          |
| `roles.create` (custom)      | ❌     | ❌     | ❌    | ✅          |
| `roles.update`               | ❌     | ❌     | ❌    | ✅          |
| `roles.delete` (custom only) | ❌     | ❌     | ❌    | ✅          |
| `roles.permission.assign`    | ❌     | ❌     | ❌    | ✅          |

#### Tokens

| Action                      | VIEWER | EDITOR | ADMIN | SUPER_ADMIN |
| --------------------------- | ------ | ------ | ----- | ----------- |
| `tokens.read` (own only)    | ✅     | ✅     | ✅    | ✅          |
| `tokens.create` (own only)  | ✅     | ✅     | ✅    | ✅          |
| `tokens.revoke` (own only)  | ✅     | ✅     | ✅    | ✅          |
| `tokens.read` (all users)   | ❌     | ❌     | ✅    | ✅          |
| `tokens.revoke` (all users) | ❌     | ❌     | ✅    | ✅          |

#### Agent Tokens

| Action                      | VIEWER | EDITOR | ADMIN | SUPER_ADMIN |
| --------------------------- | ------ | ------ | ----- | ----------- |
| `agent-tokens.read`         | ❌     | ❌     | ✅    | ✅          |
| `agent-tokens.create`       | ❌     | ❌     | ✅    | ✅          |
| `agent-tokens.revoke`       | ❌     | ❌     | ✅    | ✅          |
| `agent-tokens.session.read` | ❌     | ❌     | ✅    | ✅          |

#### Webhooks

| Action                   | VIEWER | EDITOR | ADMIN | SUPER_ADMIN |
| ------------------------ | ------ | ------ | ----- | ----------- |
| `webhooks.read`          | ❌     | ❌     | ✅    | ✅          |
| `webhooks.create`        | ❌     | ❌     | ✅    | ✅          |
| `webhooks.update`        | ❌     | ❌     | ✅    | ✅          |
| `webhooks.delete`        | ❌     | ❌     | ✅    | ✅          |
| `webhooks.test`          | ❌     | ❌     | ✅    | ✅          |
| `webhooks.delivery.read` | ❌     | ❌     | ✅    | ✅          |

#### Plugins

| Action                  | VIEWER | EDITOR | ADMIN | SUPER_ADMIN |
| ----------------------- | ------ | ------ | ----- | ----------- |
| `plugins.read`          | ❌     | ❌     | ✅    | ✅          |
| `plugins.install`       | ❌     | ❌     | ❌    | ✅          |
| `plugins.enable`        | ❌     | ❌     | ❌    | ✅          |
| `plugins.disable`       | ❌     | ❌     | ❌    | ✅          |
| `plugins.uninstall`     | ❌     | ❌     | ❌    | ✅          |
| `plugins.config.read`   | ❌     | ❌     | ✅    | ✅          |
| `plugins.config.update` | ❌     | ❌     | ❌    | ✅          |

#### Forms

| Action                       | VIEWER | EDITOR | ADMIN | SUPER_ADMIN |
| ---------------------------- | ------ | ------ | ----- | ----------- |
| `forms.read`                 | ❌     | ✅     | ✅    | ✅          |
| `forms.create`               | ❌     | ❌     | ✅    | ✅          |
| `forms.update`               | ❌     | ❌     | ✅    | ✅          |
| `forms.delete` (→ trash)     | ❌     | ❌     | ✅    | ✅          |
| `forms.restore`              | ❌     | ❌     | ✅    | ✅          |
| `forms.submission.read`      | ❌     | ✅     | ✅    | ✅          |
| `forms.submission.mark-read` | ❌     | ✅     | ✅    | ✅          |

#### Menus, Settings, Locales

| Action            | VIEWER | EDITOR | ADMIN | SUPER_ADMIN |
| ----------------- | ------ | ------ | ----- | ----------- |
| `menus.read`      | ✅     | ✅     | ✅    | ✅          |
| `menus.create`    | ❌     | ❌     | ✅    | ✅          |
| `menus.update`    | ❌     | ❌     | ✅    | ✅          |
| `menus.delete`    | ❌     | ❌     | ✅    | ✅          |
| `menus.item.*`    | ❌     | ❌     | ✅    | ✅          |
| `settings.read`   | ❌     | ❌     | ✅    | ✅          |
| `settings.update` | ❌     | ❌     | ✅    | ✅          |
| `locales.read`    | ✅     | ✅     | ✅    | ✅          |
| `locales.create`  | ❌     | ❌     | ✅    | ✅          |
| `locales.update`  | ❌     | ❌     | ✅    | ✅          |
| `locales.delete`  | ❌     | ❌     | ❌    | ✅          |

#### Audit & Trash

| Action                   | VIEWER | EDITOR | ADMIN | SUPER_ADMIN |
| ------------------------ | ------ | ------ | ----- | ----------- |
| `audit.read`             | ❌     | ❌     | ✅    | ✅          |
| `audit.export`           | ❌     | ❌     | ✅    | ✅          |
| `trash.read`             | ❌     | ❌     | ✅    | ✅          |
| `trash.restore`          | ❌     | ❌     | ✅    | ✅          |
| `trash.permanent-delete` | ❌     | ❌     | ❌    | ✅          |

---

## 7. Field-Level Permissions

Content fields can be restricted so that specific roles can read or write them selectively. This is separate from content-type level access.

### Use Cases

- A `salary` field on an `employee` content type: readable by ADMIN only, hidden from EDITOR
- An `internalNotes` field: writable by ADMIN, readable by EDITOR, hidden from VIEWER
- A `publishedRevenue` field: readable by all but only writable by SUPER_ADMIN

### Field Permission Model

Field permissions are stored in `ContentField.config`:

```typescript
// ContentField.config (JSON)
{
  "fieldPermissions": {
    "read": ["SUPER_ADMIN", "ADMIN"],     // roles that can see this field
    "write": ["SUPER_ADMIN"]              // roles that can edit this field
  }
}
```

**Default (no `fieldPermissions` set):** inherits the content-type permission — whatever can read/write the entry can read/write the field.

### Enforcement at API Layer

```typescript
// ContentService — applied on every read and write
private filterFieldsByPermission(
  data: Record<string, unknown>,
  fields: ContentField[],
  userRoles: string[],
  operation: 'read' | 'write',
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};

  for (const field of fields) {
    const perms = field.config?.fieldPermissions;
    if (!perms) {
      // no restriction — pass through
      filtered[field.name] = data[field.name];
      continue;
    }

    const allowed = perms[operation] as string[] | undefined;
    if (!allowed || userRoles.some(role => allowed.includes(role))) {
      filtered[field.name] = data[field.name];
    }
    // silently omit restricted fields — never throw 403 on field access
  }

  return filtered;
}
```

> Restricted fields are **silently omitted** from responses, never throwing a 403. This prevents information leakage about what fields exist.

---

## 8. Content-Type Scoped Permissions

Permissions can be scoped to a specific content type instead of applying globally (`*`).

### Example: Editor who can only manage `blog-post`

```json
{
  "permissions": [
    { "resource": "content", "action": "read", "scope": "*" },
    { "resource": "content", "action": "create", "scope": "blog-post" },
    { "resource": "content", "action": "update", "scope": "blog-post" },
    { "resource": "content", "action": "delete", "scope": "blog-post" },
    { "resource": "content", "action": "publish", "scope": "blog-post" }
  ]
}
```

This user can read all content types but can only create/update/delete/publish `blog-post` entries.

### Scope Resolution

```typescript
// RbacGuard — scope check
function hasPermission(
  userPermissions: Permission[],
  resource: string,
  action: string,
  targetScope: string, // e.g. "blog-post"
): boolean {
  return userPermissions.some(
    (p) =>
      p.resource === resource &&
      p.action === action &&
      (p.scope === '*' || p.scope === targetScope),
  );
}
```

`scope: "*"` always wins. Specific scopes only match their exact content type.

---

## 9. Agent Token Scopes (MCP)

Agent tokens use a fine-grained JSON scope instead of roles. Every MCP tool call is validated against the agent's scope before execution.

### Scope Format

```typescript
interface AgentScope {
  content?: AgentAction[]; // ["read", "create", "update", "publish"]
  'content-types'?: AgentAction[]; // ["read"]
  media?: AgentAction[]; // ["read", "upload"]
  seo?: AgentAction[]; // ["read", "validate"]
  plugins?: AgentAction[]; // ["read"]
  users?: AgentAction[]; // []
  settings?: AgentAction[]; // []
  audit?: AgentAction[]; // ["read"]
  webhooks?: AgentAction[]; // []
  forms?: AgentAction[]; // []
  menus?: AgentAction[]; // []
  locales?: AgentAction[]; // ["read"]
}

type AgentAction =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'publish'
  | 'unpublish'
  | 'validate'
  | 'upload'
  | 'install'
  | 'enable'
  | 'disable';
```

### MCP Tool → Required Scope Mapping

| MCP Tool                        | Required owner permission |
| ------------------------------- | ------------------------- |
| `list_content_entries`          | `content:read`            |
| `get_content_entry`             | `content:read`            |
| `create_content_entry`          | `content:create`          |
| `update_content_entry`          | `content:update`          |
| `publish_content_entry`         | `content:publish`         |
| `delete_content_entry`          | `content:delete`          |
| `list_content_types`            | `content-types:read`      |
| `get_content_type`              | `content-types:read`      |
| `create_content_type`           | `content-types:create`    |
| `update_content_type`           | `content-types:update`    |
| `list_media` / `get_media_file` | `media:read`              |
| `get_seo_score`                 | `seo:read`                |
| `validate_seo`                  | `seo:validate`            |
| `get_audit_log`                 | `audit:read`              |

### Agent Safety Layers

Beyond scope checking, every agent request goes through additional safety gates:

```
Agent MCP Call
      ↓
[1. Token validation]    → invalid token → reject
      ↓
[2. Scope check]         → tool not in scope → reject with SCOPE_DENIED
      ↓
[3. Dry-run check]       → if isDryRun=true → simulate, return preview, do NOT apply
      ↓
[4. Execute tool]
      ↓
[5. Audit log]           → write immutable log with agentTokenId + tool + diff
```

**Dry-run mode:**

Every destructive MCP tool supports a `dryRun: true` parameter. When set:

- The operation is validated and simulated
- The result is returned as a preview
- Nothing is written to the database
- The audit log records the dry-run with `isDryRun: true`

```typescript
// MCP tool example with dry-run
publish_content_entry({ typeSlug: 'blog-post', entryId: 'clentry001', dryRun: true })

// Response preview — nothing published
{
  "preview": {
    "wouldPublish": "clentry001",
    "currentStatus": "DRAFT",
    "seoScore": 72,
    "seoWarnings": ["Meta description too short"]
  },
  "dryRun": true
}
```

---

## 10. Plugin Permission Model

Plugins are treated as **untrusted third-party code** regardless of source.

### Plugin Manifest — Permission Declaration

Every plugin must declare exactly what it needs in `kast.plugin.ts`:

```typescript
export default definePlugin({
  name: '@kast-cms/plugin-stripe',
  version: '1.0.0',
  compatibleWith: '^1.0.0',

  permissions: {
    // Database access — what models can this plugin read/write
    data: {
      ContentEntry: ['read'], // can read entries
      MediaFile: ['read'], // can read media
      FormSubmission: ['read'], // can read submissions
      // Cannot access: User, ApiToken, AgentToken, AuditLog, etc.
    },

    // API hooks — what lifecycle events can this plugin listen to
    hooks: ['content.beforePublish', 'content.afterPublish', 'form.afterSubmit'],

    // Network — what external URLs can this plugin call
    network: ['https://api.stripe.com', 'https://hooks.stripe.com'],

    // Admin UI — what panels can this plugin add
    admin: [
      'panel:payments', // adds a "Payments" panel to admin sidebar
    ],

    // Environment variables — what env vars can this plugin access
    env: ['STRIPE_PUBLIC_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
  },
});
```

### What Plugins Cannot Do (Enforced by Sandbox)

| Restriction                                                       | Why                                          |
| ----------------------------------------------------------------- | -------------------------------------------- |
| Cannot access `User`, `ApiToken`, `AgentToken`, `AuditLog` models | Security — no access to secrets or auth data |
| Cannot make network requests to URLs not in manifest              | Prevents data exfiltration                   |
| Cannot read env vars not in manifest                              | Prevents secret leakage                      |
| Cannot modify plugin manifests at runtime                         | Prevents privilege escalation                |
| Cannot call other plugins' APIs directly                          | No plugin-to-plugin attack surface           |
| Cannot write to `GlobalSettings`                                  | Prevents configuration tampering             |
| Cannot register new RBAC permissions                              | Permissions are install-time only            |

### Plugin Installation Flow

```
SUPER_ADMIN installs plugin
        ↓
[Parse manifest — validate permissions declared]
        ↓
[SUPER_ADMIN reviews and approves permission list]
        ↓
[Plugin stored in DB with status: inactive]
        ↓
[SUPER_ADMIN enables plugin]
        ↓
[NestJS loads plugin as Dynamic Module with restricted context]
        ↓
[Plugin can only access what was declared in manifest]
```

---

## 11. Data Security

### Password Storage

```typescript
// Never store plain text. Never use MD5/SHA1.
const hash = await argon2.hash(password, { type: argon2.argon2id });
const isValid = await argon2.verify(hash, plainPassword);
```

### Token Storage

```typescript
// All tokens hashed before storage
import { createHash } from 'crypto';

function hashToken(plainToken: string): string {
  return createHash('sha256').update(plainToken).digest('hex');
}

// On creation: store hash, return plain once
const plain = `kast_${randomBytes(24).toString('base64url')}`;
const hash = hashToken(plain);
await db.apiToken.create({ data: { tokenHash: hash, prefix: plain.slice(0, 12) } });
return plain; // shown once, never stored

// On validation: hash incoming, compare to stored
const incoming = request.headers['authorization']?.slice(7);
const hash = hashToken(incoming);
const token = await db.apiToken.findUnique({ where: { tokenHash: hash } });
```

### Plugin Config Encryption

Plugin configuration values (API keys, secrets) are encrypted at the service layer before writing to `PluginConfig.data`:

```typescript
// AES-256-GCM via Node.js crypto
// Key derived from PLUGIN_CONFIG_ENCRYPTION_KEY env var (required, min 32 chars)
const encrypted = this.encryptionService.encrypt(JSON.stringify(config));
await db.pluginConfig.upsert({ data: { data: encrypted } });
```

### OAuth Token Storage

OAuth `accessToken` from providers is encrypted at rest (same AES-256-GCM). Refresh tokens from OAuth providers are never stored.

### Database Security

```
- DATABASE_URL uses SSL in production (sslmode=require)
- Prisma uses parameterized queries — no raw SQL with user input
- JSONB fields are stored as-is — no eval, no dynamic queries on JSON content
- Database credentials are never logged
```

---

## 12. Input Validation

### Two Layers of Validation

**Layer 1 — DTO (class-validator) — shape and type:**

```typescript
export class CreateContentDto {
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim()) // sanitize whitespace
  title: string;

  @IsEnum(ContentStatus)
  status: ContentStatus;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
```

**Layer 2 — Service (business rules) — semantic validity:**

```typescript
async createEntry(dto: CreateContentDto): Promise<ContentEntry> {
  // DTO already validated — now check business rules
  const type = await this.contentTypeRepository.findByName(dto.contentType);
  if (!type) throw new NotFoundException('Content type not found');

  if (dto.status === ContentStatus.PUBLISHED) {
    throw new UnprocessableEntityException('Cannot create a published entry — publish after creation');
  }

  // Validate field values against content type schema
  await this.validateFieldValues(dto.data, type.fields);

  return this.contentRepository.create(dto);
}
```

### HTML Sanitization

Rich text fields accept HTML from editors. All HTML is sanitized before storage:

```typescript
import DOMPurify from 'isomorphic-dompurify';

function sanitizeRichText(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'u',
      'h1',
      'h2',
      'h3',
      'h4',
      'ul',
      'ol',
      'li',
      'a',
      'img',
      'blockquote',
      'code',
      'pre',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'target', 'rel', 'class'],
    FORBID_SCRIPTS: true,
    FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input'],
  });
}
```

### File Upload Validation

```typescript
// MediaModule — file upload guard
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'text/plain',
  'text/csv',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB — configurable in GlobalSettings

if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
  throw new UnsupportedMediaTypeException(`File type ${file.mimetype} not allowed`);
}

if (file.size > MAX_FILE_SIZE) {
  throw new PayloadTooLargeException(`File exceeds max size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
}

// Double-check MIME by reading file magic bytes — don't trust the header alone
const actualMime = await fileTypeFromBuffer(file.buffer);
if (actualMime?.mime !== file.mimetype) {
  throw new BadRequestException('File type mismatch — MIME header does not match content');
}
```

---

## 13. Audit Trail

Every mutation in Kast — whether by a human, an API token, or an AI agent — writes an immutable `AuditLog` record.

### What Gets Audited

| Event Category | Examples                                                            |
| -------------- | ------------------------------------------------------------------- |
| Content        | create, update, publish, unpublish, trash, restore, version revert  |
| Schema         | content type create/update/delete, field create/update/delete       |
| Auth           | login, logout, failed login attempt, password change, OAuth connect |
| Tokens         | API token create/revoke, agent token create/revoke                  |
| Media          | upload, update (alt text), trash, restore, permanent delete         |
| SEO            | meta update, redirect create/update/delete                          |
| Users          | create, update role, trash, restore                                 |
| Plugins        | install, enable, disable, uninstall, config update                  |
| Settings       | any GlobalSetting update                                            |
| MCP            | every agent tool call (real + dry-run)                              |

### Audit Log Record

```typescript
// AuditLog fields
{
  id: string; // cuid
  userId: string | null; // human actor (null if agent or system)
  agentTokenId: string | null; // AI agent actor
  agentName: string | null; // "claude-sonnet-4", "cursor"
  ipAddress: string | null;
  userAgent: string | null;

  action: string; // "content.publish"
  resource: string; // "ContentEntry"
  resourceId: string | null;

  before: Json | null; // snapshot before change
  after: Json | null; // snapshot after change
  metadata: Json | null; // additional context

  isDryRun: boolean; // MCP dry-run operations

  createdAt: DateTime; // immutable timestamp
}
```

### Immutability Guarantees

```typescript
// AuditService — creates records, never updates or deletes them
async log(event: AuditEvent): Promise<void> {
  await this.prisma.auditLog.create({ data: event });
  // No update(). No delete(). No upsert().
  // Audit logs are append-only forever.
}

// If an admin attempts DELETE /audit/:id → 405 Method Not Allowed
// The endpoint does not exist in the API spec intentionally
```

### Sensitive Field Redaction

Before writing `before`/`after` diffs, the audit service redacts sensitive fields:

```typescript
const REDACTED_FIELDS = ['passwordHash', 'tokenHash', 'secretHash', 'accessToken'];

function redactSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) =>
      REDACTED_FIELDS.includes(key) ? [key, '***REDACTED***'] : [key, value],
    ),
  );
}
```

---

## 14. NestJS Implementation

### Guard Execution Order

NestJS applies guards, interceptors, and pipes in this exact order:

```
Request
   ↓
[Global middleware]     → Helmet (HTTP headers) + CORS + Rate Limiting
   ↓
[Route guards]          → AuthGuard → RbacGuard → (FieldPermissionGuard)
   ↓
[Pipes]                 → ValidationPipe (DTO validation + transformation)
   ↓
[Route handler]         → Controller method
   ↓
[Interceptors]          → AuditInterceptor (writes log after response)
   ↓
Response
```

### Global Setup (`main.ts`)

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Layer 1 — HTTP security headers
  app.use(helmet(helmetConfig));

  // Layer 1 — CORS (config loaded from GlobalSettings)
  app.enableCors(await buildCorsConfig(app));

  // Layer 2 — Rate limiting (via @nestjs/throttler)
  // Configured per-route via @Throttle() decorator

  // Input validation — reject unknown fields, transform types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields
      forbidNonWhitelisted: true, // throw if unknown fields sent
      transform: true, // auto-transform types
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // Global exception filter — consistent error shape
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global audit interceptor
  app.useGlobalInterceptors(new AuditInterceptor());

  await app.listen(process.env['PORT'] ?? 3001);
}
```

### RBAC Guard

```typescript
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<Permission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermission) return true; // no permission required

    const { user } = context.switchToHttp().getRequest();
    return this.hasPermission(user, requiredPermission);
  }

  private hasPermission(user: AuthUser, required: Permission): boolean {
    // SUPER_ADMIN always passes
    if (user.roles.includes('SUPER_ADMIN')) return true;

    return user.permissions.some(
      (p) =>
        p.resource === required.resource &&
        p.action === required.action &&
        (p.scope === '*' || p.scope === required.scope),
    );
  }
}
```

### Permission Decorator

```typescript
// Usage on controller methods
@Post(':type/:id/publish')
@RequirePermission({ resource: 'content', action: 'publish', scope: ':type' })
async publish(@Param('type') type: string, @Param('id') id: string) {
  return this.contentService.publishEntry(id);
}
```

### Throttle Decorator

```typescript
// Per-route rate limit overrides
@Post('submit')
@Throttle({ default: { limit: 10, ttl: 60000 } }) // 10/min — form submit
async submit(@Param('slug') slug: string, @Body() dto: FormSubmitDto) {
  return this.formsService.submit(slug, dto);
}
```

---

## 15. Security Checklist

Verified before every release. All items must pass.

### Authentication

- [ ] JWT secret is min 32 chars, validated on startup
- [ ] JWT refresh secret is separate from access token secret
- [ ] Refresh tokens are stored as SHA-256 hashes — never plain text
- [ ] Token rotation on every refresh — old token revoked immediately
- [ ] Access token lifetime is 15 minutes
- [ ] OAuth flows use state parameter (CSRF protection)

### Authorization

- [ ] Every protected endpoint has `@RequirePermission` decorator
- [ ] RbacGuard applied globally — no endpoint skips it unintentionally
- [ ] SUPER_ADMIN accounts cannot be modified by ADMIN
- [ ] Privilege escalation tested — EDITOR cannot grant ADMIN-level tokens
- [ ] Agent token scopes enforced on every MCP tool call

### HTTP Security

- [ ] All security headers present and correct (verified via securityheaders.com)
- [ ] HSTS preload submitted for production domain
- [ ] CSP blocks inline scripts in production
- [ ] CORS locked to specific origins in production (not `*`)
- [ ] Rate limiting tested — 429 returned on breach

### Data

- [x] Passwords hashed with Argon2id
- [ ] API/agent tokens shown once, stored as hash
- [ ] Plugin config values encrypted at rest
- [ ] No secrets in logs (verified by log grep test)
- [ ] Database uses SSL in production
- [ ] Audit log is append-only (no update/delete routes exist)

### Input

- [ ] All DTOs use class-validator with `whitelist: true`
- [ ] Rich text sanitized with DOMPurify before storage
- [ ] File uploads validated by MIME type AND magic bytes
- [ ] File size limits enforced (configurable, not hardcoded)
- [ ] SQL injection impossible — Prisma parameterizes all queries

### Plugins

- [ ] Plugin manifest parsed and permission list shown to admin before install
- [ ] Plugin network access verified — only declared URLs allowed
- [ ] Plugin cannot access User, ApiToken, AuditLog models

---

_Document version: 0.1_
_Last updated: April 2026_
_Roles: 4 system + custom | Resources: 16 | Total permission actions: 67_
_Status: Ready for NestJS implementation_
