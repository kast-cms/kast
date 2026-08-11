import type { GlobalSetting } from '@prisma/client';
import { isSecretSettingKey, toSafeSetting } from './settings-secret.util';

function buildRow(overrides: Partial<GlobalSetting> = {}): GlobalSetting {
  return {
    id: 'set1',
    key: 'site.name',
    value: 'Kast CMS',
    group: 'site',
    label: null,
    isPublic: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedBy: null,
    ...overrides,
  } as GlobalSetting;
}

describe('isSecretSettingKey', () => {
  it.each([
    'smtp.password',
    'SMTP.PASSWORD',
    'storage.s3.secretAccessKey',
    'search.apiKey',
    'search.api_key',
    'plugin.resend.token',
    'billing.privateKey',
    'vault.credential',
    'vault.credentials',
    'db.passphrase',
  ])('classifies %s as secret', (key) => {
    expect(isSecretSettingKey(key)).toBe(true);
  });

  it.each([
    'site.name',
    'site.url',
    'smtp.host',
    'smtp.user',
    'smtp.from',
    'storage.provider',
    'cors.allowedOrigins',
    'robots.txt',
    'seo.defaultMetaTitle',
    'content.defaultStatus',
    'media.imageQuality',
    // A credential word anywhere but the end of the last segment is not a secret.
    'password.policy.minLength',
  ])('classifies %s as non-secret', (key) => {
    expect(isSecretSettingKey(key)).toBe(false);
  });
});

describe('toSafeSetting', () => {
  it('strips the value of a secret row but reports it as configured', () => {
    const safe = toSafeSetting(buildRow({ key: 'smtp.password', value: 'enc:v1:a:b:c' }));

    expect(safe.value).toBeNull();
    expect(safe.isSecret).toBe(true);
    expect(safe.configured).toBe(true);
  });

  it('reports a blank secret as not configured', () => {
    const safe = toSafeSetting(buildRow({ key: 'smtp.password', value: '' }));

    expect(safe.value).toBeNull();
    expect(safe.configured).toBe(false);
  });

  it('leaves non-secret values intact', () => {
    const safe = toSafeSetting(buildRow({ key: 'site.name', value: 'Kast CMS' }));

    expect(safe.value).toBe('Kast CMS');
    expect(safe.isSecret).toBe(false);
    expect(safe.configured).toBe(true);
  });
});
