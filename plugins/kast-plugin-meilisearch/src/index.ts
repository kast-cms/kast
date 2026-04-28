import { IKastPlugin, KastPluginContext, PluginHook } from '@kast-cms/plugin-sdk';

interface ContentPublishedPayload {
  entryId: string;
  typeSlug: string;
  status: string;
}

interface ContentTrashedPayload {
  entryId: string;
  typeSlug: string;
}

interface MeilisearchDocument {
  id: string;
  [key: string]: unknown;
}

export class MeilisearchPlugin implements IKastPlugin {
  private host = '';
  private masterKey = '';
  private indexPrefix = 'kast_';
  private apiBase = '';

  async onLoad(ctx: KastPluginContext): Promise<void> {
    this.host = process.env['MEILISEARCH_HOST'] ?? '';
    this.masterKey = process.env['MEILISEARCH_MASTER_KEY'] ?? '';
    this.indexPrefix = process.env['MEILISEARCH_INDEX_PREFIX'] ?? 'kast_';

    if (!this.host || !this.masterKey) {
      console.warn(
        '[kast-plugin-meilisearch] MEILISEARCH_HOST or MEILISEARCH_MASTER_KEY not set — plugin disabled',
      );
      return;
    }

    this.apiBase = this.host.replace(/\/$/, '');

    ctx.on(PluginHook.CONTENT_PUBLISHED, async (payload) => {
      const p = payload as ContentPublishedPayload;
      await this.indexEntry(p.entryId, p.typeSlug);
    });

    ctx.on(PluginHook.CONTENT_UPDATED, async (payload) => {
      const p = payload as ContentPublishedPayload;
      // Only re-index if already published
      if (p.status === 'PUBLISHED') {
        await this.indexEntry(p.entryId, p.typeSlug);
      }
    });

    ctx.on(PluginHook.CONTENT_TRASHED, async (payload) => {
      const p = payload as ContentTrashedPayload;
      await this.deleteEntry(p.entryId, p.typeSlug);
    });

    console.log(`[kast-plugin-meilisearch] Connected to ${this.host}`);
  }

  private indexName(typeSlug: string): string {
    return `${this.indexPrefix}${typeSlug}`;
  }

  /**
   * Fetches the content entry from the Kast API and upserts it into Meilisearch.
   * In production the Kast API URL is available via KAST_API_URL env var.
   */
  private async indexEntry(entryId: string, typeSlug: string): Promise<void> {
    try {
      const kastApiBase = (process.env['KAST_API_URL'] ?? 'http://localhost:3001').replace(
        /\/$/,
        '',
      );
      const res = await fetch(`${kastApiBase}/api/v1/content/${typeSlug}/${entryId}`, {
        headers: { 'x-kast-internal': 'plugin' },
      });
      if (!res.ok) {
        console.warn(`[kast-plugin-meilisearch] Could not fetch entry ${entryId} (${res.status})`);
        return;
      }
      const json = (await res.json()) as { data: MeilisearchDocument };
      const doc = { ...json.data, id: entryId };
      await this.meiliRequest('POST', `/indexes/${this.indexName(typeSlug)}/documents`, [doc]);
    } catch (err) {
      console.error(`[kast-plugin-meilisearch] indexEntry error: ${String(err)}`);
    }
  }

  private async deleteEntry(entryId: string, typeSlug: string): Promise<void> {
    try {
      await this.meiliRequest(
        'DELETE',
        `/indexes/${this.indexName(typeSlug)}/documents/${entryId}`,
      );
    } catch (err) {
      console.error(`[kast-plugin-meilisearch] deleteEntry error: ${String(err)}`);
    }
  }

  private async meiliRequest(method: string, path: string, body?: unknown): Promise<void> {
    const res = await fetch(`${this.apiBase}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.masterKey}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Meilisearch ${method} ${path} → ${res.status}: ${text}`);
    }
  }
}

export default MeilisearchPlugin;
