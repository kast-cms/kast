import { KastClient } from '@kast-cms/sdk';

/**
 * Base URL of the Kast API (NestJS).
 *
 * The API serves every route under `/api/v1` (global `api` prefix + URI
 * versioning), so `KAST_API_URL` must be the bare origin, e.g.
 * `http://localhost:3000` — paths are appended by the helpers below.
 */
export const KAST_API_URL = process.env.KAST_API_URL ?? 'http://localhost:3000';

/** Optional read-only delivery key. Raises rate limits / bypasses CORS for SSR. */
const KAST_API_KEY = process.env.KAST_API_KEY;

/** Default locale requested from the public Delivery API. */
export const KAST_LOCALE = process.env.KAST_LOCALE ?? 'en';

/**
 * SDK client — used only for optional, best-effort SEO enrichment
 * (`kast.seo.*`). Public content is read through the Delivery API below.
 */
export const kast = new KastClient({
  baseUrl: KAST_API_URL,
  ...(KAST_API_KEY ? { apiKey: KAST_API_KEY } : {}),
});

/* ── Public Delivery API ─────────────────────────────────────────────────
 * Frontends read PUBLISHED content from `/api/v1/delivery/*`. These endpoints
 * are public (no token required); an optional `X-Kast-Key` may be sent.
 * See https://kastcms.com/docs/api-reference/delivery
 * ------------------------------------------------------------------------ */

/** Envelope returned by list endpoints. */
export interface DeliveryListResponse<T> {
  data: T[];
  meta: { total: number; limit: number; cursor: string | null; hasNextPage: boolean };
}

/** Envelope returned by single-resource endpoints. */
export interface DeliveryItemResponse<T> {
  data: T;
}

/** SEO metadata embedded on a published delivery entry. */
export interface DeliverySeoMeta {
  metaTitle: string | null;
  metaDescription: string | null;
  ogTitle: string | null;
  ogImageUrl: string | null;
  noIndex: boolean;
}

/** A single published entry as returned by the Delivery API. */
export interface DeliveryEntry<TData = Record<string, unknown>> {
  id: string;
  slug: string;
  publishedAt: string | null;
  data: TData;
  seoMeta?: DeliverySeoMeta | null;
}

interface DeliveryRequestOptions {
  /** Query params appended to the request (besides `locale`). */
  query?: Record<string, string | undefined>;
  /** Override the default locale; pass `null` to omit the param entirely. */
  locale?: string | null;
}

/**
 * Low-level fetch against the public Delivery API. Throws on non-2xx so callers
 * can decide how to degrade (the content helpers swallow errors).
 */
export async function deliveryFetch<T>(
  path: string,
  opts: DeliveryRequestOptions = {},
): Promise<T> {
  const params = new URLSearchParams();
  const locale = opts.locale === undefined ? KAST_LOCALE : opts.locale;
  if (locale) params.set('locale', locale);
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value !== undefined) params.set(key, value);
  }
  const qs = params.toString();
  const url = `${KAST_API_URL}/api/v1/delivery${path}${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    headers: KAST_API_KEY ? { 'X-Kast-Key': KAST_API_KEY } : {},
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`Kast delivery request failed (${res.status}): ${path}`);
  }
  return (await res.json()) as T;
}
