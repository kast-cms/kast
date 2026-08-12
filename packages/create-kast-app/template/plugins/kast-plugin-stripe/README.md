# kast-plugin-stripe

Sync Kast product content types to [Stripe](https://stripe.com) and receive payment webhooks.

## Setup

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRODUCT_TYPE_SLUG=product      # The content-type slug to sync (default: product)

KAST_API_URL=http://127.0.0.1:3000    # optional, the Kast API origin (not the admin app on 3001)
KAST_API_TOKEN=kast_...               # required — a Kast API token whose owner can read content
```

`KAST_API_TOKEN` is not optional in practice. Lifecycle hooks carry only an entry
id, so the plugin reads the product fields back from the management content API,
which requires authentication. Create the token under **Settings → API Tokens**
in the admin; the plugin only issues GET requests, so a **read-only** token is
enough. Without it the plugin logs a warning once at startup and syncs
nothing.

## How it works

- On `content.published` for the configured content type → creates or updates a Stripe Product (and Price if `price` field exists)
- On `content.updated` (when PUBLISHED) → updates the Stripe product
- On `content.trashed` → archives the Stripe product

### Expected content type fields

| Field             | Type             | Description                                 |
| ----------------- | ---------------- | ------------------------------------------- |
| `name` or `title` | TEXT             | Product name                                |
| `description`     | RICH_TEXT / TEXT | Product description                         |
| `price`           | NUMBER           | Unit price (in dollars/major currency unit) |
| `currency`        | SELECT           | Currency code (default: `usd`)              |

## Webhook endpoint

`POST /api/v1/stripe/webhook` — receives Stripe events and validates with `STRIPE_WEBHOOK_SECRET`.

## Admin panel

Accessible at `/plugins/stripe` in the Kast admin.
