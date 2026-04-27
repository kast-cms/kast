import { IKastPlugin, KastPluginContext } from '@kast/plugin-sdk';

/**
 * kast-plugin-r2
 *
 * Activates the Cloudflare R2 storage adapter in the Kast API.
 * When STORAGE_PROVIDER=r2 and the R2_* env vars are set, all media
 * uploads are stored in Cloudflare R2 via the R2StorageAdapter.
 *
 * No code changes are needed — the API automatically picks up the
 * R2 adapter based on the STORAGE_PROVIDER env var.
 */
export class R2Plugin implements IKastPlugin {
  async onLoad(ctx: KastPluginContext): Promise<void> {
    const provider = process.env['STORAGE_PROVIDER'];
    const accountId = process.env['R2_ACCOUNT_ID'];
    const bucket = process.env['R2_BUCKET_NAME'];

    if (provider !== 'r2') {
      console.warn(
        '[kast-plugin-r2] STORAGE_PROVIDER is not set to "r2" — plugin registered but inactive',
      );
      return;
    }

    if (!accountId || !bucket) {
      console.warn(
        '[kast-plugin-r2] R2_ACCOUNT_ID or R2_BUCKET_NAME not set — storage will fall back to local',
      );
      return;
    }

    const publicUrl = process.env['R2_PUBLIC_URL'] ?? '';

    await ctx.setConfig({
      provider: 'r2',
      accountId,
      bucket,
      publicUrl: publicUrl || null,
      configuredAt: new Date().toISOString(),
    });

    console.log(`[kast-plugin-r2] Active — media stored in R2 bucket "${bucket}"`);
  }
}

export default R2Plugin;
