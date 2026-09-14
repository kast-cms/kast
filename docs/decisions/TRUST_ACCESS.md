# Trust and access

## Account security

Open **Account → Account security** (also available in Settings → Security) to
configure an authenticator, replace recovery codes, and revoke devices. Enrollment
requires a sign-in within the last ten minutes. The secret is encrypted at rest;
only the confirmation response contains the ten recovery codes. Save them before
leaving the page.

Password, Google, GitHub, and generic OIDC sign-ins all require the local second
factor when enabled. Primary authentication returns a challenge without access or
refresh tokens. Challenges expire after five minutes and permit one attempt;
a failed attempt requires signing in again. Authenticator timesteps and recovery
codes are consumed with a database compare-and-swap, preventing concurrent reuse.

Session identifiers stay stable across refresh-token rotation. Refreshing a token
is atomic: two requests with the same credential cannot both succeed. Sessions
expire 30 days after the original sign-in. Revocation immediately invalidates
both access and refresh tokens, including the queue dashboard cookie. Password
changes and resets revoke all sessions. Changing MFA settings revokes other
sessions while preserving the device performing the change. API and agent tokens
cannot manage account security; they retain their separate revocation controls.

## OIDC configuration

Set all three values and restart the API:

```dotenv
OIDC_ISSUER_URL=https://identity.example.com/realms/my-organization
OIDC_CLIENT_ID=kast
OIDC_CLIENT_SECRET=your-provider-client-secret
OIDC_SCOPES=openid email profile
```

Register `${SITE_URL}/api/v1/auth/oauth/oidc/callback` as the provider redirect URI.
The issuer must use HTTPS and support discovery, authorization-code flow, and
PKCE S256. The client validates the ID-token signature, issuer, audience, nonce,
and expiry. State is single-use, stored in Redis, and bound to an HttpOnly,
SameSite=Lax browser cookie. Google and GitHub use the same browser-bound state
pattern. The login page displays only configured providers.

The implementation uses [openid-client](https://github.com/panva/openid-client).
Run Node 20.19+ or 22.12+ (or a newer supported release) for CommonJS/ESM
compatibility. Existing installations using `OIDC_AUTHORIZATION_URL`,
`OIDC_TOKEN_URL`, or `OIDC_USERINFO_URL` must replace those values with
`OIDC_ISSUER_URL`; arbitrary endpoint configuration is no longer used.
Provisioning still follows `OAUTH_SIGNUP_MODE` and its domain allowlist. Linking
an existing account by email requires the provider's verified-email claim.
Subjects are scoped to their issuer so changing identity providers does not
silently reuse a different provider's subject identifier.

## API compatibility and upgrade

The new account endpoints are under `/api/v1/auth/two-factor`:

| Method | Path                         | Purpose                                           |
| ------ | ---------------------------- | ------------------------------------------------- |
| GET    | `/two-factor`                | Status and remaining recovery-code count          |
| POST   | `/two-factor/setup`          | Encrypted enrollment with QR image and manual key |
| POST   | `/two-factor/enable`         | Confirm enrollment using a code                   |
| POST   | `/two-factor/verify`         | Exchange a login challenge and code for tokens    |
| POST   | `/two-factor/recovery-codes` | Replace all recovery codes                        |
| POST   | `/two-factor/disable`        | Disable using a current code                      |
| GET    | `/sessions`                  | Active devices, with `current` marker             |
| DELETE | `/sessions/:id`              | Revoke an owned session (204)                     |
| DELETE | `/sessions`                  | Revoke every session, including this device       |
| GET    | `/providers`                 | Configured sign-in providers                      |

Existing `/auth/mfa` endpoints and SDK method names remain supported. Challenge
responses contain both `mfaRequired` and `requiresTwoFactor`. Existing authenticator
secrets and unused Argon2 recovery hashes migrate without reenrollment. Newly
issued recovery codes use random 64-bit values with SHA-256 storage hashes.

Apply migrations before starting the upgraded API. The migration published on
`main` is unchanged; a new migration follows it. The earlier unpublished
`feat/trust-access` schema migration has been replaced to avoid duplicate session
columns on fresh installs. A disposable development database that applied that unpublished migration must
be recreated or have its schema and migration history reconciled with `main`
before upgrading; otherwise the published migration would add duplicate session
columns. The production upgrade path from `main` is covered by the migration tests.
Old access tokens without a session identifier require refresh or sign-in.
