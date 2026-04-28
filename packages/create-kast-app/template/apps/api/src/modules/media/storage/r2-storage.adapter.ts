import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema';
import type { StorageAdapter } from './storage.adapter';

/**
 * Cloudflare R2 storage adapter.
 * R2 is S3-compatible — this adapter uses the AWS SDK with a custom endpoint.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
 */
@Injectable()
export class R2StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService<Env>) {
    const accountId = config.get('R2_ACCOUNT_ID', { infer: true }) ?? '';
    this.bucket = config.get('R2_BUCKET_NAME', { infer: true }) ?? '';
    this.publicUrl = (config.get('R2_PUBLIC_URL', { infer: true }) ?? '').replace(/\/$/, '');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.get('R2_ACCESS_KEY_ID', { infer: true }) ?? '',
        secretAccessKey: config.get('R2_SECRET_ACCESS_KEY', { infer: true }) ?? '',
      },
    });
  }

  async upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ url: string; storageKey: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    const url = this.publicUrl ? `${this.publicUrl}/${key}` : key;
    return { url, storageKey: key };
  }

  async read(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const stream = res.Body as NodeJS.ReadableStream;
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }
}
