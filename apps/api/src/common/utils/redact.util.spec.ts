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

  it('redacts common credential-shaped object keys', () => {
    const out = redactSensitive({
      apiKey: 'sk-live',
      accessKey: 'access',
      clientSecret: 'client-secret',
      passphrase: 'phrase',
      webhookSigningKey: 'signing-key',
      ordinaryKey: 'visible',
    }) as Record<string, unknown>;

    expect(out).toEqual({
      apiKey: '***REDACTED***',
      accessKey: '***REDACTED***',
      clientSecret: '***REDACTED***',
      passphrase: '***REDACTED***',
      webhookSigningKey: '***REDACTED***',
      ordinaryKey: 'visible',
    });
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

  it('keeps a JSON __proto__ key an own property instead of mutating the prototype', () => {
    // JSON.parse creates `__proto__` as a plain own key; an object literal
    // would not, so the fixture has to come from text. A crafted body must
    // survive redaction without the copy inheriting anything from it.
    const body = JSON.parse('{"__proto__":{"polluted":"yes"},"email":"a@b.com"}');
    const out = redactSensitive(body) as Record<string, unknown>;

    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect((out as { polluted?: unknown }).polluted).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(out, '__proto__')?.value).toEqual({
      polluted: 'yes',
    });
    expect(out['email']).toBe('a@b.com');
  });
});
