import { type IKastPlugin, type KastPluginContext, PluginHook } from '@kast-cms/plugin-sdk';
import { type Index, Meilisearch, type SearchResponse } from 'meilisearch';

/** Payload emitted on content.published / content.updated. */
interface ContentLifecyclePayload {
  entryId: string;
  typeSlug: string;
  status?: string;
}

/** Payload emitted on content.trashed / content.unpublished. */
interface ContentRemovalPayload {
  entryId: string;
  typeSlug: string;
}

/** Locale row attached to a content entry by the Kast content API. */
interface EntryLocale {
  localeCode?: string;
  slug?: string | null;
  data?: Record<string, unknown> | null;
}

/** Shape of a single entry as returned by the Kast content API. */
interface KastEntry {
  id: string;
  status?: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  locales?: EntryLocale[];
}

/** A flattened document ready to be stored in a Meilisearch index. */
interface MeiliDocument extends Record<string, unknown> {
  id: string;
  typeSlug: string;
}

const LOG_PREFIX = '[kast-plugin-meilisearch]';

/**
 * Indexes published Kast content into Meilisearch and removes it again when the
 * content is trashed or unpublished. Uses the official `meilisearch` SDK for all
 * search-engine traffic.
 *
 * Limitation: the Kast plugin context (`KastPluginContext`) only delivers event
 * payloads containing identifiers (`entryId`, `typeSlug`, `status`) and exposes
 * no content-data accessor. The full entry body is therefore fetched over HTTP
 * from the Kast content API (`KAST_API_URL`). If/when the SDK gains a content
 * read API on the context, `fetchEntry` should switch to it.
 */
export class MeilisearchPlugin implements IKastPlugin {
  private client: Meilisearch | null = null;
  private indexPrefix = 'kast_';

  async onLoad(ctx: KastPluginContext): Promise<void> {
    const host = process.env['MEILISEARCH_HOST'] ?? '';
    const apiKey = process.env['MEILISEARCH_MASTER_KEY'] ?? '';
    this.indexPrefix = process.env['MEILISEARCH_INDEX_PREFIX'] ?? 'kast_';

    if (!host || !apiKey) {
      this.warn('MEILISEARCH_HOST or MEILISEARCH_MASTER_KEY not set — plugin disabled');
      return;
    }

    this.client = new Meilisearch({ host, apiKey });

    ctx.on(PluginHook.CONTENT_PUBLISHED, (payload) => this.onUpsert(payload));
    ctx.on(PluginHook.CONTENT_UPDATED, (payload) => this.onUpdate(payload));
    ctx.on(PluginHook.CONTENT_TRASHED, (payload) => this.onRemove(payload));
    ctx.on(PluginHook.CONTENT_UNPUBLISHED, (payload) => this.onRemove(payload));

    await ctx.setConfig({
      provider: 'meilisearch',
      host,
      indexPrefix: this.indexPrefix,
      configuredAt: new Date().toISOString(),
    });

    this.log(`Connected to ${host} (index prefix "${this.indexPrefix}")`);
  }

  /**
   * Full-text search over a content type's index. Exposed as a public method so
   * other in-process code (e.g. a future search controller) can reuse it.
   */
  async search<T extends Record<string, unknown> = MeiliDocument>(
    typeSlug: string,
    query: string,
    limit = 20,
  ): Promise<SearchResponse<T>> {
    if (!this.client) {
      throw new Error(`${LOG_PREFIX} search called before plugin was configured`);
    }
    return this.client.index<T>(this.indexName(typeSlug)).search(query, { limit });
  }

  private async onUpsert(payload: unknown): Promise<void> {
    const p = payload as ContentLifecyclePayload;
    await this.indexEntry(p.entryId, p.typeSlug);
  }

  private async onUpdate(payload: unknown): Promise<void> {
    const p = payload as ContentLifecyclePayload;
    // Only mirror updates that keep the entry published; drafts are removed.
    if (p.status === 'PUBLISHED') {
      await this.indexEntry(p.entryId, p.typeSlug);
    } else {
      await this.removeEntry(p.entryId, p.typeSlug);
    }
  }

  private async onRemove(payload: unknown): Promise<void> {
    const p = payload as ContentRemovalPayload;
    await this.removeEntry(p.entryId, p.typeSlug);
  }

  private indexName(typeSlug: string): string {
    return `${this.indexPrefix}${typeSlug}`;
  }

  private async index(typeSlug: string): Promise<Index<MeiliDocument>> {
    const client = this.requireClient();
    const uid = this.indexName(typeSlug);
    // Ensure the index exists with `id` as its primary key (idempotent).
    await client.createIndex(uid, { primaryKey: 'id' }).catch(() => undefined);
    return client.index<MeiliDocument>(uid);
  }

  private async indexEntry(entryId: string, typeSlug: string): Promise<void> {
    if (!this.client) return;
    try {
      const entry = await this.fetchEntry(entryId, typeSlug);
      if (!entry) {
        this.warn(`Could not fetch entry ${entryId} for indexing`);
        return;
      }
      const index = await this.index(typeSlug);
      await index.addDocuments([this.toDocument(entry, entryId, typeSlug)]);
    } catch (err) {
      this.error(`indexEntry(${entryId}) failed: ${stringifyError(err)}`);
    }
  }

  private async removeEntry(entryId: string, typeSlug: string): Promise<void> {
    if (!this.client) return;
    try {
      const index = await this.index(typeSlug);
      await index.deleteDocument(entryId);
    } catch (err) {
      this.error(`removeEntry(${entryId}) failed: ${stringifyError(err)}`);
    }
  }

  /** Flattens the localized entry into a single searchable document. */
  private toDocument(entry: KastEntry, entryId: string, typeSlug: string): MeiliDocument {
    const primary = entry.locales?.[0];
    const fields = (primary?.data ?? {}) as Record<string, unknown>;
    return {
      ...fields,
      id: entryId,
      typeSlug,
      ...(primary?.localeCode !== undefined ? { locale: primary.localeCode } : {}),
      ...(primary?.slug != null ? { slug: primary.slug } : {}),
      ...(entry.status !== undefined ? { status: entry.status } : {}),
      ...(entry.publishedAt != null ? { publishedAt: entry.publishedAt } : {}),
      ...(entry.updatedAt != null ? { updatedAt: entry.updatedAt } : {}),
    };
  }

  /**
   * Retrieves a content entry from the Kast content API. See the class-level
   * note for why HTTP is used here rather than a context method.
   */
  private async fetchEntry(entryId: string, typeSlug: string): Promise<KastEntry | null> {
    const base = (process.env['KAST_API_URL'] ?? 'http://localhost:3001').replace(/\/$/, '');
    const url = `${base}/api/v1/content-types/${encodeURIComponent(typeSlug)}/entries/${encodeURIComponent(entryId)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: KastEntry };
    return json.data ?? null;
  }

  private requireClient(): Meilisearch {
    if (!this.client) {
      throw new Error(`${LOG_PREFIX} client used before configuration`);
    }
    return this.client;
  }

  private log(message: string): void {
    process.stderr.write(`${LOG_PREFIX} ${message}\n`);
  }

  private warn(message: string): void {
    process.stderr.write(`${LOG_PREFIX} WARN ${message}\n`);
  }

  private error(message: string): void {
    process.stderr.write(`${LOG_PREFIX} ERROR ${message}\n`);
  }
}

function stringifyError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default MeilisearchPlugin;
