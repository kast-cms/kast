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

@Injectable()
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService<Env>) {
    this.bucket = config.get('AWS_S3_BUCKET', { infer: true }) ?? '';
    this.client = new S3Client({
      region: config.get('AWS_REGION', { infer: true }) ?? 'us-east-1',
      credentials: {
        accessKeyId: config.get('AWS_ACCESS_KEY_ID', { infer: true }) ?? '',
        secretAccessKey: config.get('AWS_SECRET_ACCESS_KEY', { infer: true }) ?? '',
      },
    });
  }

  async upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ url: string; storageKey: string }> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: mimeType }),
    );
    const url = `https://${this.bucket}.s3.amazonaws.com/${key}`;
    return { url, storageKey: key };
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
