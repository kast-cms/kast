import {
  checkRedirectTarget,
  EMPTY_SEO_SETTINGS,
  parseSeoSettings,
  resolveGatePolicy,
  SEO_SETTING_KEYS,
  type SeoSettings,
} from './seo-settings';

describe('parseSeoSettings', () => {
  it('reads the saved fallbacks, policies and allowed hosts', () => {
    const parsed = parseSeoSettings([
      { key: SEO_SETTING_KEYS.defaultMetaTitle, value: 'My Site' },
      { key: SEO_SETTING_KEYS.defaultMetaDescription, value: 'A site.' },
      { key: SEO_SETTING_KEYS.gateDefaultPolicy, value: 'advisory' },
      { key: SEO_SETTING_KEYS.gateContentTypes, value: { 'blog-category': 'disabled' } },
      { key: SEO_SETTING_KEYS.redirectAllowedHosts, value: ['Docs.Example.com', ' '] },
    ]);

    expect(parsed).toEqual({
      defaultMetaTitle: 'My Site',
      defaultMetaDescription: 'A site.',
      gateDefaultPolicy: 'advisory',
      gateByContentType: { 'blog-category': 'disabled' },
      redirectAllowedHosts: ['docs.example.com'],
    });
  });

  it('ignores unusable values instead of trusting them', () => {
    const parsed = parseSeoSettings([
      { key: SEO_SETTING_KEYS.defaultMetaTitle, value: '   ' },
      { key: SEO_SETTING_KEYS.gateDefaultPolicy, value: 'whatever' },
      { key: SEO_SETTING_KEYS.gateContentTypes, value: { page: 'sometimes', post: 'enforce' } },
      { key: SEO_SETTING_KEYS.redirectAllowedHosts, value: 42 },
    ]);

    expect(parsed.defaultMetaTitle).toBeNull();
    expect(parsed.gateDefaultPolicy).toBeNull();
    expect(parsed.gateByContentType).toEqual({ post: 'enforce' });
    expect(parsed.redirectAllowedHosts).toEqual([]);
  });

  it('accepts a comma-separated host list', () => {
    const parsed = parseSeoSettings([
      { key: SEO_SETTING_KEYS.redirectAllowedHosts, value: 'a.example.com, b.example.com' },
    ]);
    expect(parsed.redirectAllowedHosts).toEqual(['a.example.com', 'b.example.com']);
  });
});

describe('resolveGatePolicy', () => {
  const settings = (over: Partial<SeoSettings> = {}): SeoSettings => ({
    ...EMPTY_SEO_SETTINGS,
    ...over,
  });

  it('enforces a page-like type and leaves a body-less type advisory by default', () => {
    expect(resolveGatePolicy(settings(), 'article', true)).toBe('enforce');
    expect(resolveGatePolicy(settings(), 'blog-category', false)).toBe('advisory');
  });

  it('prefers the per-type setting over the global default', () => {
    const s = settings({
      gateDefaultPolicy: 'disabled',
      gateByContentType: { article: 'enforce' },
    });
    expect(resolveGatePolicy(s, 'article', true)).toBe('enforce');
    expect(resolveGatePolicy(s, 'page', true)).toBe('disabled');
  });

  it.each(['constructor', 'toString', 'valueOf', '__proto__'])(
    'does not read %s off Object.prototype as a configured policy',
    (name) => {
      expect(resolveGatePolicy(settings(), name, true)).toBe('enforce');
      expect(resolveGatePolicy(settings({ gateDefaultPolicy: 'advisory' }), name, true)).toBe(
        'advisory',
      );
    },
  );

  it('keeps the per-type map free of inherited members when it is parsed', () => {
    const parsed = parseSeoSettings([
      { key: SEO_SETTING_KEYS.gateContentTypes, value: { article: 'disabled' } },
    ]);

    expect(resolveGatePolicy(parsed, 'constructor', true)).toBe('enforce');
    expect(resolveGatePolicy(parsed, 'article', true)).toBe('disabled');
  });

  it('falls back to the built-in default for an unknown content type', () => {
    expect(resolveGatePolicy(settings(), undefined, false)).toBe('advisory');
  });
});

describe('checkRedirectTarget', () => {
  it('accepts site-relative targets', () => {
    expect(checkRedirectTarget('/new-home', [])).toEqual({ ok: true });
    expect(checkRedirectTarget('  /new-home?x=1  ', [])).toEqual({ ok: true });
  });

  it.each(['//evil.example', '/\\evil.example'])(
    'refuses the protocol-relative target %s',
    (target) => {
      expect(checkRedirectTarget(target, ['evil.example'])).toMatchObject({ ok: false });
    },
  );

  it.each(['javascript:alert(1)', 'data:text/html,x', 'mailto:a@b.c', 'relative/path', ''])(
    'refuses the non-path target %s',
    (target) => {
      expect(checkRedirectTarget(target, [])).toMatchObject({ ok: false });
    },
  );

  it('refuses an external host that is not allow-listed', () => {
    const verdict = checkRedirectTarget('https://evil.example/phish', ['docs.example.com']);
    expect(verdict).toMatchObject({ ok: false });
    if (!verdict.ok) expect(verdict.reason).toContain('evil.example');
  });

  it('accepts an allow-listed external host regardless of case', () => {
    expect(checkRedirectTarget('https://Docs.Example.com/guide', ['docs.example.com'])).toEqual({
      ok: true,
    });
  });
});
