import { describeInertSetting, enforcedBy, getSettingDefinition } from './settings-catalog';

describe('settings catalog lookups', () => {
  it('describes a catalogued key', () => {
    expect(getSettingDefinition('robots.txt')).toEqual({ enforcedBy: 'GET /v1/robots.txt' });
    expect(enforcedBy('cors.allowedOrigins')).toBeNull();
    expect(describeInertSetting('cors.allowedOrigins')).toContain('CORS_ORIGINS');
  });

  it.each(['constructor', 'toString', 'valueOf', '__proto__'])(
    'treats %s as an uncatalogued key rather than an inherited member',
    (key) => {
      expect(getSettingDefinition(key)).toBeUndefined();
      expect(enforcedBy(key)).toBeNull();
      expect(describeInertSetting(key)).toContain('comes from nothing');
    },
  );
});
