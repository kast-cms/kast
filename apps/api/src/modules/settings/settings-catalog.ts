/**
 * What the runtime actually does with each known setting.
 *
 * A key listed with `enforcedBy` is read by the named code path. A key listed
 * with `effectiveSource` is one the admin used to offer while nothing consumed
 * it: the API hides those rows and refuses to store them, so a value that is
 * shown is a value that has an effect.
 *
 * Keys that are absent from this catalog are treated as caller-defined data:
 * they are stored and returned untouched.
 */
export interface SettingDefinition {
  /** The runtime path that reads the value, or null when nothing reads it. */
  enforcedBy: string | null;
  /** For unenforced keys, where the effective value really comes from. */
  effectiveSource?: string;
}

const ENV_SMTP_NOTE =
  'POST /settings/test-smtp (queued mail is still sent with the SMTP_* environment variables)';

const SETTING_CATALOG: Record<string, SettingDefinition> = {
  'site.name': { enforcedBy: 'GET /delivery/settings, when the row is marked public' },
  'site.url': { enforcedBy: 'GET /delivery/settings, when the row is marked public' },
  'site.maintenanceMode': {
    enforcedBy: 'MaintenanceMiddleware — serves 503 on /delivery routes while true',
  },

  'smtp.host': { enforcedBy: ENV_SMTP_NOTE },
  'smtp.port': { enforcedBy: ENV_SMTP_NOTE },
  'smtp.user': { enforcedBy: ENV_SMTP_NOTE },
  'smtp.password': { enforcedBy: ENV_SMTP_NOTE },
  'smtp.from': { enforcedBy: ENV_SMTP_NOTE },
  'smtp.fromName': { enforcedBy: ENV_SMTP_NOTE },

  'storage.provider': {
    enforcedBy: null,
    effectiveSource: 'the STORAGE_PROVIDER environment variable',
  },
  'storage.maxFileSizeMb': {
    enforcedBy: null,
    effectiveSource: 'the UPLOAD_MAX_FILE_SIZE_MB environment variable',
  },
  'storage.allowedMimeTypes': {
    enforcedBy: null,
    effectiveSource: 'the UPLOAD_ALLOWED_MIME_TYPES environment variable',
  },
  'media.imageQuality': {
    enforcedBy: null,
    effectiveSource: 'the media optimisation worker, which is not configurable yet',
  },
  'media.generateThumbnails': {
    enforcedBy: null,
    effectiveSource: 'the media optimisation worker, which is not configurable yet',
  },
  'cors.allowedOrigins': {
    enforcedBy: null,
    effectiveSource: 'the CORS_ORIGINS environment variable, applied at bootstrap',
  },
  'robots.txt': { enforcedBy: 'GET /v1/robots.txt' },
  'seo.defaultMetaTitle': { enforcedBy: 'SeoService — fallback meta title' },
  'seo.defaultMetaDescription': { enforcedBy: 'SeoService — fallback meta description' },
  'seo.gate.defaultPolicy': { enforcedBy: 'SeoService — publish gate policy' },
  'seo.gate.contentTypes': { enforcedBy: 'SeoService — per-content-type publish gate policy' },
  'seo.redirects.allowedHosts': { enforcedBy: 'SeoService — redirect target allow-list' },
  'content.defaultStatus': {
    enforcedBy: null,
    effectiveSource: 'nothing — new entries are always created as DRAFT',
  },
  'content.versionRetention': {
    enforcedBy: null,
    effectiveSource: 'nothing — content versions are kept indefinitely',
  },
};

/** Setting keys are caller-supplied, so `constructor` and friends must not resolve. */
function lookup(key: string): SettingDefinition | undefined {
  return Object.hasOwn(SETTING_CATALOG, key) ? SETTING_CATALOG[key] : undefined;
}

export function getSettingDefinition(key: string): SettingDefinition | undefined {
  return lookup(key);
}

/** True for catalogued keys that no runtime path reads. */
export function isInertSettingKey(key: string): boolean {
  return lookup(key)?.enforcedBy === null;
}

export function enforcedBy(key: string): string | null {
  return lookup(key)?.enforcedBy ?? null;
}

export function describeInertSetting(key: string): string {
  const source = lookup(key)?.effectiveSource ?? 'nothing';
  return `Setting "${key}" is not read by the runtime; the effective value comes from ${source}.`;
}
