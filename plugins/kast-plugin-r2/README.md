# kast-plugin-r2

Store Kast media assets in [Cloudflare R2](https://www.cloudflare.com/products/r2/) (S3-compatible object storage with no egress fees).

## Setup

```env
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=your-cf-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=kast-media
R2_PUBLIC_URL=https://media.yourdomain.com   # Your R2 public bucket URL
```

## How it works

Setting `STORAGE_PROVIDER=r2` activates the `R2StorageAdapter` in the Kast API, routing all media uploads, reads, and deletes through Cloudflare R2 using the S3-compatible API.

The plugin validates the required env vars at boot and persists the configuration for the admin UI.

## Admin panel

Accessible at `/plugins/r2` in the Kast admin — shows current storage configuration and bucket status.
