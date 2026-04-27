# kast-plugin-meilisearch

Sync published Kast content to [Meilisearch](https://www.meilisearch.com/) for full-text search.

## Setup

Add to your `.env`:

```env
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_MASTER_KEY=your-master-key
MEILISEARCH_INDEX_PREFIX=kast_   # optional, default: kast_
```

## How it works

- On `content.published` → upserts the entry into `kast_<typeSlug>` Meilisearch index
- On `content.updated` → re-indexes if status is `PUBLISHED`
- On `content.trashed` → removes the document from the index

## Search endpoint

The Kast API exposes `GET /api/v1/search?q=<query>&type=<typeSlug>` when this plugin is enabled.

## Admin panel

Accessible at `/plugins/meilisearch` in the Kast admin.
