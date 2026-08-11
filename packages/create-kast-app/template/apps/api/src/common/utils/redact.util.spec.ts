import { redactSensitive } from './redact.util';

describe('redactSensitive', () => {
  it('redacts top-level sensitive keys case-insensitively', () => {
    const out = redactSensitive({
      email: 'a@b.com',
      password: 'hunter2',
      passwordHash: 'argon$...',
      Secret: 'shh',
    }) as Record<string, unknown>;
    expect(out['email']).toBe('a@b.com');
    expect(out['password']).toBe('***REDACTED***');
    expect(out['passwordHash']).toBe('***REDACTED***');
    expect(out['Secret']).toBe('***REDACTED***');
  });

  it('redacts nested sensitive keys', () => {
    const out = redactSensitive({
      user: { name: 'x', tokenHash: 'abc', nested: { secretHash: 'def' } },
    }) as { user: { name: string; tokenHash: string; nested: { secretHash: string } } };
    expect(out.user.name).toBe('x');
    expect(out.user.tokenHash).toBe('***REDACTED***');
    expect(out.user.nested.secretHash).toBe('***REDACTED***');
  });

  it('redacts the value of a {key,value} settings pair naming a credential', () => {
    const out = redactSensitive({
      settings: [
        { key: 'smtp.password', value: 'hunter2' },
        { key: 'search.apiKey', value: 'sk-live-123' },
        { key: 'site.title', value: 'My Site' },
      ],
    }) as { settings: Array<{ key: string; value: string }> };

    expect(out.settings[0]?.value).toBe('***REDACTED***');
    expect(out.settings[1]?.value).toBe('***REDACTED***');
    expect(out.settings[2]?.value).toBe('My Site');
    expect(JSON.stringify(out)).not.toContain('hunter2');
    expect(JSON.stringify(out)).not.toContain('sk-live-123');
  });

  it('leaves a {key,value} pair alone when the key is not a credential', () => {
    const out = redactSensitive({ key: 'smtp.host', value: 'mail.example.com' }) as {
      key: string;
      value: string;
    };
    expect(out.value).toBe('mail.example.com');
  });

  it('handles arrays and primitives without throwing', () => {
    expect(redactSensitive([{ token: 't' }, 1, 'str'])).toEqual([
      { token: '***REDACTED***' },
      1,
      'str',
    ]);
    expect(redactSensitive(null)).toBeNull();
    expect(redactSensitive(42)).toBe(42);
  });
});
