/** Envelope every Kast management endpoint wraps its payload in. */
interface KastApiEnvelope<T> {
  data?: T;
}

const DEFAULT_API_PORT = '3000';
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Origin of the Kast API. Plugins are loaded in-process by the API itself, so
 * the fallback is loopback on the API's own PORT — 3001 is the admin app.
 */
export function resolveKastApiBaseUrl(): string {
  const configured = process.env['KAST_API_URL']?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const port = process.env['PORT']?.trim();
  return `http://127.0.0.1:${port !== undefined && port !== '' ? port : DEFAULT_API_PORT}`;
}

/** Kast API token used to authenticate management reads, if one is configured. */
export function resolveKastApiToken(): string | undefined {
  const primary = process.env['KAST_API_TOKEN']?.trim();
  if (primary !== undefined && primary !== '') return primary;
  const fallback = process.env['KAST_API_KEY']?.trim();
  if (fallback !== undefined && fallback !== '') return fallback;
  return undefined;
}

/**
 * Reads content entries back out of Kast on behalf of a plugin.
 *
 * The public delivery API cannot serve this: it addresses entries by slug and
 * locale, while lifecycle hook payloads carry only an entry id. The management
 * route is therefore used, authenticated with a Kast API token whose owning
 * user can read content. Environment is captured at construction time.
 */
export class KastApiClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly warn: (message: string) => void;
  private readonly warned = new Set<string>();

  constructor(warn: (message: string) => void) {
    this.baseUrl = resolveKastApiBaseUrl();
    this.token = resolveKastApiToken();
    this.warn = warn;
  }

  /** True when a token is configured; without one every fetch is a no-op. */
  get isConfigured(): boolean {
    return this.token !== undefined;
  }

  /**
   * Fetches a single entry. Returns null when the entry cannot be read;
   * transport failures propagate so the caller can log them.
   */
  async fetchEntry<T>(typeSlug: string, entryId: string): Promise<T | null> {
    const token = this.token;
    if (token === undefined) {
      this.warnMissingToken();
      return null;
    }

    const url = `${this.baseUrl}/api/v1/content-types/${encodeURIComponent(typeSlug)}/entries/${encodeURIComponent(entryId)}`;
    const res = await fetch(url, {
      headers: this.headers(token),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status === 401 || res.status === 403) {
      this.warnTokenRejected(res.status);
      return null;
    }
    if (!res.ok) return null;

    const json = (await res.json()) as KastApiEnvelope<T>;
    return json.data ?? null;
  }

  /**
   * Whether a content type of this slug is defined. Returns null when the
   * answer cannot be established — no token, a rejected token, a transport
   * failure or any other unexpected status — so callers can tell "no such type"
   * apart from "could not ask". Advisory, so transport failures are swallowed
   * rather than propagated.
   */
  async contentTypeExists(typeSlug: string): Promise<boolean | null> {
    const token = this.token;
    if (token === undefined) {
      this.warnMissingToken();
      return null;
    }

    const url = `${this.baseUrl}/api/v1/content-types/${encodeURIComponent(typeSlug)}`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: this.headers(token),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      return null;
    }

    if (res.status === 404) return false;
    if (res.status === 401 || res.status === 403) {
      this.warnTokenRejected(res.status);
      return null;
    }
    return res.ok ? true : null;
  }

  private headers(token: string): Record<string, string> {
    return { 'X-Kast-Key': token, Accept: 'application/json' };
  }

  private warnMissingToken(): void {
    this.warnOnce(
      'missing-token',
      'KAST_API_TOKEN is not set — content cannot be read from the Kast API and nothing will be synced',
    );
  }

  private warnTokenRejected(status: number): void {
    this.warnOnce(
      'token-rejected',
      `Kast API rejected KAST_API_TOKEN (HTTP ${status}) — it must belong to a user who can read content`,
    );
  }

  /** Emits a configuration warning at most once per process, per cause. */
  private warnOnce(key: string, message: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.warn(message);
  }
}
