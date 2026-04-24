export interface StorageAdapter {
  upload(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ url: string; storageKey: string }>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}
