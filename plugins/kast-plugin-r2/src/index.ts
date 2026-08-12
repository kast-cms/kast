import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type IKastPlugin, type KastPluginContext } from '@kast-cms/plugin-sdk';

/** Object payload accepted by the storage adapter. */
export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  cacheControl?: string;
}

/** Object returned by the storage adapter on read. */
export interface GetObjectOutput {
  body: Uint8Array;
  contentType?: string;
}

const LOG_PREFIX = '[kast-plugin-r2]';

/**
 * Cloudflare R2 (S3-compatible) object-storage adapter built on
 * `@aws-sdk/client-s3`. Provides put / get / delete / presigned-URL operations
 * and a public-URL helper for media assets.
 *
 * When enabled, the plugin registers itself as the host's `r2` storage adapter.
 */
export class R2Plugin implements IKastPlugin {
  private client: S3Client | null = null;
  private bucket = '';
  private publicUrl = '';

  async onLoad(ctx: KastPluginContext): Promise<void> {
    const accountId = process.env['R2_ACCOUNT_ID'] ?? '';
    const accessKeyId = process.env['R2_ACCESS_KEY_ID'] ?? '';
    const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY'] ?? '';
    this.bucket = process.env['R2_BUCKET_NAME'] ?? '';
    this.publicUrl = (process.env['R2_PUBLIC_URL'] ?? '').replace(/\/$/, '');

    if (!accountId || !accessKeyId || !secretAccessKey || !this.bucket) {
      this.warn(
        'R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY or R2_BUCKET_NAME not set — ' +
          'storage will fall back to the host default',
      );
      return;
    }

    // R2 presents a single regionless S3 endpoint per account; `auto` is the
    // canonical region value Cloudflare expects.
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    await ctx.setConfig({
      provider: 'r2',
      bucket: this.bucket,
      publicUrl: this.publicUrl || null,
      configuredAt: new Date().toISOString(),
    });

    ctx.registerStorageAdapter({
      provider: 'r2',
      upload: async (key, body, mimeType) => {
        await this.put({ key, body, contentType: mimeType });
        return {
          storageKey: key,
          url: this.publicUrlFor(key) ?? (await this.getSignedUrl(key, 3600)),
        };
      },
      read: async (key) => (await this.get(key)).body,
      delete: (key) => this.delete(key),
      getSignedUrl: (key, expiresInSeconds) => this.getSignedUrl(key, expiresInSeconds),
    });

    this.log(`Active — R2 adapter ready for bucket "${this.bucket}"`);
  }

  /** True once valid R2 credentials and a bucket have been supplied. */
  isReady(): boolean {
    return this.client !== null;
  }

  /** Uploads (or overwrites) an object in the R2 bucket. */
  async put(input: PutObjectInput): Promise<void> {
    const client = this.requireClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ...(input.contentType !== undefined ? { ContentType: input.contentType } : {}),
        ...(input.cacheControl !== undefined ? { CacheControl: input.cacheControl } : {}),
      }),
    );
  }

  /** Reads an object from the R2 bucket into memory. */
  async get(key: string): Promise<GetObjectOutput> {
    const client = this.requireClient();
    const res = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!res.Body) {
      throw new Error(`${LOG_PREFIX} object "${key}" has no body`);
    }
    const body = await res.Body.transformToByteArray();
    return {
      body,
      ...(res.ContentType !== undefined ? { contentType: res.ContentType } : {}),
    };
  }

  /** Deletes an object from the R2 bucket. */
  async delete(key: string): Promise<void> {
    const client = this.requireClient();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** Generates a time-limited presigned GET URL for an object. */
  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const client = this.requireClient();
    return getSignedUrl(client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  /**
   * Returns the public URL for an object when a `R2_PUBLIC_URL` (custom domain
   * or r2.dev) is configured; otherwise null.
   */
  publicUrlFor(key: string): string | null {
    if (!this.publicUrl) return null;
    return `${this.publicUrl}/${key.replace(/^\/+/, '')}`;
  }

  async onUnload(): Promise<void> {
    this.client?.destroy();
    this.client = null;
  }

  private requireClient(): S3Client {
    if (!this.client) {
      throw new Error(`${LOG_PREFIX} storage operation attempted before configuration`);
    }
    return this.client;
  }

  private log(message: string): void {
    process.stderr.write(`${LOG_PREFIX} ${message}\n`);
  }

  private warn(message: string): void {
    process.stderr.write(`${LOG_PREFIX} WARN ${message}\n`);
  }
}

export default R2Plugin;
