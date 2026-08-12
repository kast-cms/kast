# kast-plugin-resend

Send transactional emails via [Resend](https://resend.com) instead of SMTP.

## Setup

```env
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=hello@yourdomain.com
RESEND_FROM_NAME=Your App              # optional
```

## How it works

When `RESEND_API_KEY` is set, the Kast `EmailProcessor` automatically routes all queued emails through the Resend HTTP API. No SMTP configuration is needed.

If `RESEND_API_KEY` is not set, the processor falls back to SMTP as usual.

## Admin panel

Accessible at `/plugins/resend` in the Kast admin — shows current transport status and allows sending a test email.
