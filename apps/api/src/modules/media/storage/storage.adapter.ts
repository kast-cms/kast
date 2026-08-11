/** Persisted on MediaFile.provider so a row records which backend holds its bytes. */
export type StorageProviderId = 'local' | 's3' | 'r2';

export interface StorageAdapter {
  readonly provider: StorageProviderId;
  upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ url: string; storageKey: string }>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}
