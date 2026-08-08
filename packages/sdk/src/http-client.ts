import type { KastClientOptions } from './types.js';

export interface RequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
  headers?: Record<string, string>;
}

/**
 * The HTTP transport behind KastClient: auth headers, URL building, and the
 * JSON / text / blob response handling. KastClient extends this and adds the
 * resource surface on top.
 */
export class KastHttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private accessToken: string | undefined;
  private readonly _fetch: typeof globalThis.fetch;

  constructor(options: KastClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.accessToken = options.accessToken;
    // Bind to globalThis: the browser's fetch is a WebIDL operation that must be
    // invoked with the Window as its receiver. Storing it unbound and calling it
    // as `this._fetch(...)` passes the client instance instead, which throws
    // "Failed to execute 'fetch' on 'Window': Illegal invocation".
    this._fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  private buildAuthOnlyHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    else if (this.apiKey) headers['X-Kast-Key'] = this.apiKey;
    return headers;
  }

  private buildHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json', ...this.buildAuthOnlyHeaders() };
  }

  private buildRequestInit(options: RequestOptions): {
    headers: Record<string, string>;
    body: BodyInit | undefined;
  } {
    const isForm = options.formData !== undefined;
    const headers = isForm
      ? { ...this.buildAuthOnlyHeaders(), ...(options.headers ?? {}) }
      : { ...this.buildHeaders(), ...(options.headers ?? {}) };
    const body: BodyInit | undefined = isForm
      ? options.formData
      : options.body !== undefined
        ? JSON.stringify(options.body)
        : undefined;
    return { headers, body };
  }

  private buildError(json: unknown, status: number): Error & { code?: string; status?: number } {
    const err = (json as { error?: { message?: string; code?: string } }).error;
    const message = err?.message ?? `HTTP ${status}`;
    const error = new Error(message) as Error & { code?: string; status?: number };
    if (err?.code !== undefined) error.code = err.code;
    error.status = status;
    return error;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const { headers, body } = this.buildRequestInit(options);
    const res = await this._fetch(url, {
      method: options.method ?? 'GET',
      headers,
      ...(body !== undefined ? { body } : {}),
    });
    const json = (await res.json()) as unknown;
    if (!res.ok) throw this.buildError(json, res.status);
    return json as T;
  }

  /** For endpoints that return something other than JSON, e.g. sitemap.xml. */
  async requestText(path: string, options: RequestOptions = {}): Promise<string> {
    const url = `${this.baseUrl}${path}`;
    const headers = { ...this.buildAuthOnlyHeaders(), ...(options.headers ?? {}) };
    const res = await this._fetch(url, { method: options.method ?? 'GET', headers });
    const text = await res.text();
    if (!res.ok) {
      let json: unknown = {};
      try {
        json = JSON.parse(text) as unknown;
      } catch {
        // Non-JSON error body — buildError falls back to `HTTP <status>`.
      }
      throw this.buildError(json, res.status);
    }
    return text;
  }

  async requestBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
    const url = `${this.baseUrl}${path}`;
    const headers = { ...this.buildAuthOnlyHeaders(), ...(options.headers ?? {}) };
    const res = await this._fetch(url, {
      method: options.method ?? 'GET',
      headers,
    });
    if (!res.ok) {
      const json = (await res.json()) as unknown;
      throw this.buildError(json, res.status);
    }
    return res.blob();
  }
}
