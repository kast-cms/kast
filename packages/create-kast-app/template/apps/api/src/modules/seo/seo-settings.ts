/**
 * Global SEO settings (the `seo.*` rows the Settings screen writes) and the
 * policies derived from them: which content types the publish gate applies to,
 * and which redirect targets may leave the site.
 */

export const SEO_SETTING_KEYS = {
  defaultMetaTitle: 'seo.defaultMetaTitle',
  defaultMetaDescription: 'seo.defaultMetaDescription',
  gateDefaultPolicy: 'seo.gate.defaultPolicy',
  gateContentTypes: 'seo.gate.contentTypes',
  redirectAllowedHosts: 'seo.redirects.allowedHosts',
  robotsTxt: 'robots.txt',
} as const;

/** Keys `parseSeoSettings` understands; the robots.txt body is fetched separately. */
export const SEO_SETTING_KEY_LIST: string[] = [
  SEO_SETTING_KEYS.defaultMetaTitle,
  SEO_SETTING_KEYS.defaultMetaDescription,
  SEO_SETTING_KEYS.gateDefaultPolicy,
  SEO_SETTING_KEYS.gateContentTypes,
  SEO_SETTING_KEYS.redirectAllowedHosts,
];

/**
 * - `enforce`  — issues are scored and ERROR/WARNING issues block publishing.
 * - `advisory` — issues are scored and stored, but never block publishing.
 * - `disabled` — no SEO analysis runs for the content type at all.
 */
export type SeoGatePolicy = 'enforce' | 'advisory' | 'disabled';

const GATE_POLICIES = new Set<string>(['enforce', 'advisory', 'disabled']);

export interface SeoSettings {
  defaultMetaTitle: string | null;
  defaultMetaDescription: string | null;
  gateDefaultPolicy: SeoGatePolicy | null;
  gateByContentType: Record<string, SeoGatePolicy>;
  redirectAllowedHosts: string[];
}

export const EMPTY_SEO_SETTINGS: SeoSettings = {
  defaultMetaTitle: null,
  defaultMetaDescription: null,
  gateDefaultPolicy: null,
  gateByContentType: {},
  redirectAllowedHosts: [],
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function asPolicy(value: unknown): SeoGatePolicy | null {
  return typeof value === 'string' && GATE_POLICIES.has(value) ? (value as SeoGatePolicy) : null;
}

function asPolicyMap(value: unknown): Record<string, SeoGatePolicy> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const out: Record<string, SeoGatePolicy> = {};
  for (const [name, raw] of Object.entries(value as Record<string, unknown>)) {
    const policy = asPolicy(raw);
    if (policy) out[name] = policy;
  }
  return out;
}

function asHostList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\s]+/) : [];
  return raw
    .filter((host): host is string => typeof host === 'string')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host !== '');
}

export function parseSeoSettings(rows: { key: string; value: unknown }[]): SeoSettings {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  return {
    defaultMetaTitle: asString(byKey.get(SEO_SETTING_KEYS.defaultMetaTitle)),
    defaultMetaDescription: asString(byKey.get(SEO_SETTING_KEYS.defaultMetaDescription)),
    gateDefaultPolicy: asPolicy(byKey.get(SEO_SETTING_KEYS.gateDefaultPolicy)),
    gateByContentType: asPolicyMap(byKey.get(SEO_SETTING_KEYS.gateContentTypes)),
    redirectAllowedHosts: asHostList(byKey.get(SEO_SETTING_KEYS.redirectAllowedHosts)),
  };
}

/**
 * Resolves the gate policy for one content type: an explicit per-type setting
 * wins, then the configured default, then the built-in default. The built-in
 * default enforces page-like types — ones that carry a rich-text body — and
 * leaves body-less types (taxonomies, option lists) advisory, because page SEO
 * checks such as "meta title" and "300 words" do not describe them.
 */
export function resolveGatePolicy(
  settings: SeoSettings,
  contentTypeName: string | undefined,
  hasBodyField: boolean,
): SeoGatePolicy {
  const configured = contentTypeName ? settings.gateByContentType[contentTypeName] : undefined;
  if (configured) return configured;
  if (settings.gateDefaultPolicy) return settings.gateDefaultPolicy;
  return hasBodyField ? 'enforce' : 'advisory';
}

export type RedirectTargetVerdict = { ok: true } | { ok: false; reason: string };

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/**
 * A redirect target is site-relative unless the operator has listed its host in
 * `seo.redirects.allowedHosts`. Anything else — a scheme we do not serve, a bare
 * relative path, or a protocol-relative `//host` that browsers follow off-site —
 * is refused so the redirect table cannot become an open redirect.
 */
export function checkRedirectTarget(toPath: string, allowedHosts: string[]): RedirectTargetVerdict {
  const target = toPath.trim();
  if (target === '') return { ok: false, reason: 'Redirect target is empty' };

  if (target.startsWith('/')) {
    if (target.startsWith('//') || target.startsWith('/\\')) {
      return {
        ok: false,
        reason: `Protocol-relative redirect target "${target}" is not allowed`,
      };
    }
    return { ok: true };
  }

  const url = parseHttpUrl(target);
  if (!url) {
    return {
      ok: false,
      reason: `Redirect target "${target}" must be a site-relative path starting with "/" or an http(s) URL`,
    };
  }
  const host = url.hostname.toLowerCase();
  if (!allowedHosts.includes(host)) {
    return {
      ok: false,
      reason: `External redirect target "${host}" is not listed in ${SEO_SETTING_KEYS.redirectAllowedHosts}`,
    };
  }
  return { ok: true };
}
