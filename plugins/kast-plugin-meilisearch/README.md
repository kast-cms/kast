# kast-plugin-meilisearch

Sync published Kast content to [Meilisearch](https://www.meilisearch.com/) for full-text search.

## Setup

Add to your `.env`:

```env
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_MASTER_KEY=your-master-key
MEILISEARCH_INDEX_PREFIX=kast_        # optional, default: kast_
MEILISEARCH_AGGREGATE_INDEX=true      # optional, set to `false` to skip the aggregate index

KAST_API_URL=http://127.0.0.1:3000    # optional, the Kast API origin (not the admin app on 3001)
KAST_API_TOKEN=kast_...               # required — a Kast API token whose owner can read content
```

`KAST_API_TOKEN` is not optional in practice. Lifecycle hooks carry only an entry
id, so the plugin reads the entry body back from the management content API,
which requires authentication. Create the token under **Settings → API Tokens**
in the admin; the plugin only issues GET requests, so a **read-only** token is
enough. Without it the plugin logs a warning once at startup and indexes
nothing.

## How it works

- On `content.published` → upserts the entry into **both** the per-type index `kast_<typeSlug>` and the aggregate index `kast_content`
- On `content.updated` → re-indexes if status is `PUBLISHED`, otherwise removes the document
- On `content.trashed` / `content.unpublished` → removes the document from both indexes

The aggregate index carries a filterable `typeSlug` attribute. Set
`MEILISEARCH_AGGREGATE_INDEX=false` to write only per-type indexes and halve the
write/storage cost, at the price of type-less search returning nothing.

### The content type named `content`

Both index names are fixed by the search endpoint: `kast_<typeSlug>` with a
`type`, `kast_content` without one. A content type whose API id is literally
`content` therefore owns the aggregate index's name. When the plugin sees that
type — either in a lifecycle event or by asking the API before it writes the
aggregate — it warns once and stops writing the aggregate index entirely, so
`?type=content` keeps returning that type alone instead of every type in the
instance. Type-less search then covers only that one type. Rename the content
type to get the aggregate index back.

## Search endpoint

The Kast API exposes `GET /api/v1/search?q=<query>&type=<typeSlug>` when this plugin is enabled.
With `type` it queries `kast_<typeSlug>`; without it, `kast_content`.

There is no backfill command: an existing deployment that has only ever written
per-type indexes will have an empty `kast_content` until its entries are
re-published.

## Admin panel

Accessible at `/plugins/meilisearch` in the Kast admin.
