import { type IKastPlugin, type KastPluginContext, PluginHook } from '@kast-cms/plugin-sdk';
import { type Index, Meilisearch, type SearchResponse } from 'meilisearch';
import { KastApiClient } from './kast-api.js';

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
 * The content type slug whose per-type index would be the aggregate index:
 * both names are `<prefix>content`, so a content type of this slug owns that
 * uid and the aggregate has nowhere left to live.
 */
const AGGREGATE_TYPE_SLUG = 'content';

/** How long an "no such content type" answer is trusted before re-asking. */
const AGGREGATE_OWNER_TTL_MS = 300_000;

/**
 * Indexes published Kast content into Meilisearch and removes it again when the
 * content is trashed or unpublished. Uses the official `meilisearch` SDK for all
 * search-engine traffic.
 *
 * Every document is written to both `<prefix><typeSlug>` and the aggregate
 * `<prefix>content` index, because the Kast search endpoint queries the latter
 * whenever the caller supplies no `type` filter. The exception is an instance
 * that has a content type slugged `content`: that type owns the aggregate uid,
 * so aggregate writes are dropped rather than merged into it (see
 * `aggregateAvailable`).
 *
 * Limitation: the Kast plugin context (`KastPluginContext`) only delivers event
 * payloads containing identifiers (`entryId`, `typeSlug`, `status`) and exposes
 * no content-data accessor. The full entry body is therefore fetched over an
 * authenticated HTTP call to the Kast management API (see `KastApiClient`).
 * If/when the SDK gains a content read API on the context, this should switch
 * to it.
 */
export class MeilisearchPlugin implements IKastPlugin {
  private client: Meilisearch | null = null;
  private indexPrefix = 'kast_';
  private aggregateEnabled = true;
  private aggregateReady = false;
  private aggregateBlocked = false;
  private aggregateOwnerCheckedUntil = 0;
  private aggregateOwnerProbe: Promise<void> | null = null;
  private readonly api = new KastApiClient((message) => this.warn(message));

  async onLoad(ctx: KastPluginContext): Promise<void> {
    const host = process.env['MEILISEARCH_HOST'] ?? '';
    const apiKey = process.env['MEILISEARCH_MASTER_KEY'] ?? '';
    this.indexPrefix = process.env['MEILISEARCH_INDEX_PREFIX'] ?? 'kast_';
    this.aggregateEnabled = process.env['MEILISEARCH_AGGREGATE_INDEX'] !== 'false';

    if (!host || !apiKey) {
      this.warn('MEILISEARCH_HOST or MEILISEARCH_MASTER_KEY not set — plugin disabled');
      return;
    }

    this.client = new Meilisearch({ host, apiKey });

    if (!this.api.isConfigured) {
      this.warn('KAST_API_TOKEN not set — entries cannot be read back and nothing will be indexed');
    }

    ctx.on(PluginHook.CONTENT_PUBLISHED, (payload) => this.onUpsert(payload));
    ctx.on(PluginHook.CONTENT_UPDATED, (payload) => this.onUpdate(payload));
    ctx.on(PluginHook.CONTENT_TRASHED, (payload) => this.onRemove(payload));
    ctx.on(PluginHook.CONTENT_UNPUBLISHED, (payload) => this.onRemove(payload));

    await ctx.setConfig({
      provider: 'meilisearch',
      host,
      indexPrefix: this.indexPrefix,
      aggregateIndex: this.aggregateEnabled ? this.aggregateIndexName() : null,
      contentApiConfigured: this.api.isConfigured,
      configuredAt: new Date().toISOString(),
    });

    this.log(`Connected to ${host} (index prefix "${this.indexPrefix}")`);
  }

  /**
   * Full-text search over a content type's index, or over the aggregate index
   * when `typeSlug` is undefined. Exposed as a public method so other in-process
   * code (e.g. a future search controller) can reuse it.
   */
  async search<T extends Record<string, unknown> = MeiliDocument>(
    typeSlug: string | undefined,
    query: string,
    limit = 20,
  ): Promise<SearchResponse<T>> {
    if (!this.client) {
      throw new Error(`${LOG_PREFIX} search called before plugin was configured`);
    }
    const uid = typeSlug ? this.indexName(typeSlug) : this.aggregateIndexName();
    return this.client.index<T>(uid).search(query, { limit });
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

  /** Mirrors the index name SearchController uses when no `type` is supplied. */
  private aggregateIndexName(): string {
    return `${this.indexPrefix}content`;
  }

  private async index(typeSlug: string): Promise<Index<MeiliDocument>> {
    const client = this.requireClient();
    const uid = this.indexName(typeSlug);
    // Ensure the index exists with `id` as its primary key (idempotent).
    await client.createIndex(uid, { primaryKey: 'id' }).catch(() => undefined);
    return client.index<MeiliDocument>(uid);
  }

  private async aggregateIndex(): Promise<Index<MeiliDocument>> {
    const client = this.requireClient();
    const uid = this.aggregateIndexName();
    const index = client.index<MeiliDocument>(uid);
    if (this.aggregateReady) return index;
    await client.createIndex(uid, { primaryKey: 'id' }).catch(() => undefined);
    // Filtering by type is what lets a caller narrow the aggregate index later.
    await index.updateFilterableAttributes(['typeSlug']).catch(() => undefined);
    this.aggregateReady = true;
    return index;
  }

  /**
   * Every index a document for `typeSlug` belongs in: the per-type index, plus
   * the aggregate index while its name is still the plugin's to write. Entry
   * ids are globally unique, so documents never collide inside the aggregate.
   */
  private async writeTargets(typeSlug: string): Promise<Index<MeiliDocument>[]> {
    const perType = await this.index(typeSlug);
    if (!(await this.aggregateAvailable(typeSlug))) return [perType];
    return [perType, await this.aggregateIndex()];
  }

  /**
   * Whether the aggregate uid is still the plugin's to write. A content type
   * slugged `content` claims that exact uid — the Kast search endpoint pins
   * both names (`<prefix><type>` and, with no `type`, `<prefix>content`), so
   * one of the two meanings has to give. The per-type one wins: a user's own
   * index must never accumulate other types' documents, which would make
   * `?type=content` return foreign entries with no error. The cost is that
   * type-less search then covers that one type only.
   */
  private async aggregateAvailable(typeSlug: string): Promise<boolean> {
    if (!this.aggregateEnabled || this.aggregateBlocked) return false;
    // An event for that slug proves the type exists; no need to ask the API.
    if (typeSlug === AGGREGATE_TYPE_SLUG) {
      this.blockAggregate();
      return false;
    }
    await this.refreshAggregateOwner();
    return !this.aggregateBlocked;
  }

  /** Asks the API who owns the aggregate uid, at most once per TTL window. */
  private async refreshAggregateOwner(): Promise<void> {
    if (Date.now() < this.aggregateOwnerCheckedUntil) return;
    this.aggregateOwnerProbe ??= this.probeAggregateOwner();
    try {
      await this.aggregateOwnerProbe;
    } finally {
      this.aggregateOwnerProbe = null;
    }
  }

  private async probeAggregateOwner(): Promise<void> {
    const exists = await this.api.contentTypeExists(AGGREGATE_TYPE_SLUG);
    if (exists === true) {
      this.blockAggregate();
      return;
    }
    // An inconclusive answer leaves the deadline alone so the next write retries.
    if (exists === false) this.aggregateOwnerCheckedUntil = Date.now() + AGGREGATE_OWNER_TTL_MS;
  }

  private blockAggregate(): void {
    if (this.aggregateBlocked) return;
    this.aggregateBlocked = true;
    this.warn(
      `content type "${AGGREGATE_TYPE_SLUG}" owns index "${this.aggregateIndexName()}" — aggregate indexing disabled so that index holds only its own type; search without a "type" now covers that type alone`,
    );
  }

  private async indexEntry(entryId: string, typeSlug: string): Promise<void> {
    if (!this.client) return;
    try {
      const entry = await this.api.fetchEntry<KastEntry>(typeSlug, entryId);
      if (!entry) {
        this.warn(`Could not fetch entry ${entryId} for indexing`);
        return;
      }
      const document = this.toDocument(entry, entryId, typeSlug);
      const targets = await this.writeTargets(typeSlug);
      await Promise.all(targets.map((index) => index.addDocuments([document])));
    } catch (err) {
      this.error(`indexEntry(${entryId}) failed: ${stringifyError(err)}`);
    }
  }

  private async removeEntry(entryId: string, typeSlug: string): Promise<void> {
    if (!this.client) return;
    try {
      const targets = await this.writeTargets(typeSlug);
      await Promise.all(targets.map((index) => index.deleteDocument(entryId)));
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
