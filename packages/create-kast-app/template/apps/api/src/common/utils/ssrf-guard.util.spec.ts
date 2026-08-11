import { lookup } from 'dns/promises';
import {
  assertPublicUrl,
  BlockedUrlError,
  checkOutboundUrlSyntax,
  fetchGuarded,
  isHostAllowListed,
  isPrivateAddress,
  parseHostAllowList,
  parseOutboundUrl,
} from './ssrf-guard.util';

jest.mock('dns/promises', () => ({ lookup: jest.fn() }));

const mockedLookup = lookup as unknown as jest.Mock;

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '127.5.5.5',
    '10.0.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '0.0.0.0',
    '100.64.0.1', // CGNAT
    '::1',
    '::',
    '::ffff:127.0.0.1', // IPv4-mapped loopback
    '::ffff:10.0.0.1',
    'fc00::1', // ULA
    'fd12:3456::1',
    'fe80::1', // link-local
  ])('blocks private/internal address %s', (addr) => {
    expect(isPrivateAddress(addr)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34', // example.com
    '172.15.0.1', // just outside 172.16/12
    '172.32.0.1', // just outside 172.16/12
    '11.0.0.1',
    '2606:4700:4700::1111', // public IPv6 (Cloudflare)
  ])('allows public address %s', (addr) => {
    expect(isPrivateAddress(addr)).toBe(false);
  });

  it.each([
    '::ffff:7f00:1', // IPv4-mapped loopback in hex form
    '::ffff:a00:1', // IPv4-mapped 10.0.0.1 in hex form
    '::7f00:1', // IPv4-compatible loopback
    '64:ff9b::7f00:1', // NAT64 of 127.0.0.1
    '64:ff9b::127.0.0.1', // NAT64, dotted form
    '2002:7f00:1::', // 6to4 of 127.0.0.1
    '2002:a9fe:a9fe::', // 6to4 of 169.254.169.254
    'ff02::1', // multicast
    'fe80::1%eth0', // zone id
    'fe80::1%25eth0', // percent-encoded zone id
    '[::1]', // bracketed literal
    '192.0.0.1',
    '192.0.2.5',
    '198.18.0.1',
    '198.51.100.5',
    '203.0.113.5',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
  ])('blocks reserved address %s', (addr) => {
    expect(isPrivateAddress(addr)).toBe(true);
  });

  it.each([
    '2002:0808:0808::', // 6to4 of 8.8.8.8 must not be over-blocked
    '64:ff9b::808:808', // NAT64 of 8.8.8.8
    '::ffff:8.8.8.8',
    '2001:4860:4860::8888',
    'example.com', // not an IP at all
    '',
  ])('allows non-reserved value %s', (addr) => {
    expect(isPrivateAddress(addr)).toBe(false);
  });
});

describe('parseOutboundUrl', () => {
  it.each([
    ['ftp://example.com/x', 'unsupported_scheme'],
    ['file:///etc/passwd', 'unsupported_scheme'],
    ['javascript:alert(1)', 'unsupported_scheme'],
    ['not a url', 'invalid_url'],
    ['//example.com/x', 'invalid_url'],
    ['', 'invalid_url'],
  ])('rejects %s', (raw, reason) => {
    expect(() => parseOutboundUrl(raw)).toThrow(BlockedUrlError);
    try {
      parseOutboundUrl(raw);
    } catch (err) {
      expect((err as BlockedUrlError).reason).toBe(reason);
    }
  });

  it.each(['http://example.com/hook', 'https://example.com:8443/hook?a=1'])('accepts %s', (raw) => {
    expect(parseOutboundUrl(raw).protocol).toMatch(/^https?:$/);
  });
});

describe('parseHostAllowList / isHostAllowListed', () => {
  it('splits on commas and whitespace and normalises entries', () => {
    expect(parseHostAllowList(' Example.COM., 10.0.0.5 \n *.internal ,,')).toEqual([
      'example.com',
      '10.0.0.5',
      '*.internal',
    ]);
  });

  it('returns an empty list when unset', () => {
    expect(parseHostAllowList(undefined)).toEqual([]);
    expect(parseHostAllowList('')).toEqual([]);
  });

  it('matches exactly, case- and trailing-dot-insensitively', () => {
    expect(isHostAllowListed('Example.com.', ['example.com'])).toBe(true);
    expect(isHostAllowListed('evil-example.com', ['example.com'])).toBe(false);
  });

  it('matches wildcard suffixes and the apex they cover', () => {
    expect(isHostAllowListed('hooks.internal', ['*.internal'])).toBe(true);
    expect(isHostAllowListed('internal', ['*.internal'])).toBe(true);
    expect(isHostAllowListed('notinternal', ['*.internal'])).toBe(false);
  });

  it('matches IP literals as written, brackets stripped', () => {
    expect(isHostAllowListed('[::1]', ['::1'])).toBe(true);
    expect(isHostAllowListed('127.0.0.1', ['127.0.0.1'])).toBe(true);
  });

  it('never matches nothing against an empty allow-list', () => {
    expect(isHostAllowListed('example.com', [])).toBe(false);
  });
});

describe('checkOutboundUrlSyntax', () => {
  it.each([
    ['ftp://example.com/x', 'unsupported_scheme'],
    ['http://127.0.0.1:3000/x', 'private_address'],
    ['http://169.254.169.254/latest/meta-data/', 'private_address'],
    ['http://10.0.0.5/x', 'private_address'],
    ['http://192.168.0.5:8080/x', 'private_address'],
    ['https://[::1]/x', 'private_address'],
    ['http://[fd00::1]/x', 'private_address'],
    ['http://[::ffff:7f00:1]/x', 'private_address'],
    ['http://localhost/x', 'private_address'],
    ['http://api.localhost/x', 'private_address'],
    ['http://vault.internal/x', 'private_address'],
    ['http://printer.local/x', 'private_address'],
  ])('blocks %s', (raw, reason) => {
    expect(checkOutboundUrlSyntax(raw, [])).toEqual({ ok: false, reason });
  });

  it('allows public hosts and public literals without any DNS lookup', () => {
    expect(checkOutboundUrlSyntax('https://example.com/hook', [])).toEqual({ ok: true });
    expect(checkOutboundUrlSyntax('https://8.8.8.8/hook', [])).toEqual({ ok: true });
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it('lets the allow-list re-open an internal target', () => {
    expect(checkOutboundUrlSyntax('http://127.0.0.1:3000/x', ['127.0.0.1'])).toEqual({ ok: true });
    expect(checkOutboundUrlSyntax('http://hooks.internal/x', ['*.internal'])).toEqual({ ok: true });
  });
});

describe('assertPublicUrl', () => {
  beforeEach(() => {
    mockedLookup.mockReset();
  });

  it('passes a host that resolves to a public address', async () => {
    mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    await expect(assertPublicUrl(new URL('https://example.com/hook'))).resolves.toBeUndefined();
  });

  it('rejects a host that resolves to loopback', async () => {
    mockedLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);
    await expect(assertPublicUrl(new URL('https://rebind.example/hook'))).rejects.toMatchObject({
      reason: 'private_address',
    });
  });

  it('rejects when ANY resolved address is private', async () => {
    mockedLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ]);
    await expect(assertPublicUrl(new URL('https://mixed.example/hook'))).rejects.toMatchObject({
      reason: 'private_address',
    });
  });

  it('rejects an empty resolution', async () => {
    mockedLookup.mockResolvedValue([]);
    await expect(assertPublicUrl(new URL('https://void.example/hook'))).rejects.toMatchObject({
      reason: 'dns_failure',
    });
  });

  it('fails closed when the resolver errors', async () => {
    mockedLookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(assertPublicUrl(new URL('https://nope.example/hook'))).rejects.toMatchObject({
      reason: 'dns_failure',
    });
  });

  it('validates an IP literal without resolving it', async () => {
    await expect(assertPublicUrl(new URL('http://127.0.0.1:3000/x'))).rejects.toMatchObject({
      reason: 'private_address',
    });
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it('short-circuits an allow-listed host without resolving it', async () => {
    await expect(
      assertPublicUrl(new URL('http://127.0.0.1:3000/x'), { allowList: ['127.0.0.1'] }),
    ).resolves.toBeUndefined();
    expect(mockedLookup).not.toHaveBeenCalled();
  });
});

describe('BlockedUrlError', () => {
  it('reads as a verdict about the caller-supplied URL when constructed with two arguments', () => {
    expect(new BlockedUrlError('private_address', 'nope').redirectTarget).toBeUndefined();
  });
});

describe('fetchGuarded', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    mockedLookup.mockReset();
    mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  const redirect = (location: string): Response =>
    new Response(null, { status: 302, headers: { location } });

  it('sends the request with redirect: manual', async () => {
    fetchMock.mockResolvedValue(new Response('pong', { status: 200 }));
    const result = await fetchGuarded(
      'https://example.com/hook',
      { method: 'POST', body: 'ping' },
      { maxBytes: 1024 },
    );
    expect(result).toMatchObject({ status: 200, ok: true, body: 'pong', truncated: false });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', redirect: 'manual' });
  });

  it('blocks a redirect from a public host into private space before connecting again', async () => {
    fetchMock.mockResolvedValueOnce(redirect('http://127.0.0.1:8080/'));
    await expect(
      fetchGuarded('https://example.com/hook', { method: 'POST' }, { maxBytes: 1024 }),
    ).rejects.toMatchObject({ reason: 'private_address' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('blocks a redirect to a host that resolves privately', async () => {
    fetchMock.mockResolvedValueOnce(redirect('https://rebind.example/'));
    mockedLookup
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '10.1.2.3', family: 4 }]);
    await expect(
      fetchGuarded('https://example.com/hook', { method: 'POST' }, { maxBytes: 1024 }),
    ).rejects.toMatchObject({ reason: 'private_address' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a redirect to a non-http(s) scheme', async () => {
    fetchMock.mockResolvedValueOnce(redirect('file:///etc/passwd'));
    await expect(
      fetchGuarded('https://example.com/hook', { method: 'POST' }, { maxBytes: 1024 }),
    ).rejects.toMatchObject({ reason: 'unsupported_scheme' });
  });

  it('gives up after maxRedirects hops', async () => {
    fetchMock.mockResolvedValue(redirect('https://example.com/next'));
    await expect(
      fetchGuarded(
        'https://example.com/hook',
        { method: 'POST' },
        { maxBytes: 1024, maxRedirects: 2 },
      ),
    ).rejects.toMatchObject({ reason: 'too_many_redirects' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('follows a redirect to another public host', async () => {
    fetchMock
      .mockResolvedValueOnce(redirect('https://cdn.example/hook'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const result = await fetchGuarded(
      'https://example.com/hook',
      { method: 'POST' },
      { maxBytes: 1024 },
    );
    expect(result.status).toBe(200);
    expect(result.finalUrl).toBe('https://cdn.example/hook');
  });

  it('truncates an oversized response body at maxBytes', async () => {
    fetchMock.mockResolvedValue(new Response('a'.repeat(1024 * 1024), { status: 200 }));
    const result = await fetchGuarded(
      'https://example.com/hook',
      { method: 'POST' },
      { maxBytes: 64 * 1024 },
    );
    expect(Buffer.byteLength(result.body, 'utf8')).toBe(64 * 1024);
    expect(result.truncated).toBe(true);
  });

  it('rejects a non-http(s) initial URL before any fetch', async () => {
    await expect(
      fetchGuarded('ftp://example.com/x', { method: 'POST' }, { maxBytes: 1024 }),
    ).rejects.toMatchObject({ reason: 'unsupported_scheme' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves a verdict about the caller-supplied URL unattributed', async () => {
    mockedLookup.mockResolvedValue([{ address: '10.1.2.3', family: 4 }]);
    await expect(
      fetchGuarded('https://receiver.example/hook', { method: 'POST' }, { maxBytes: 1024 }),
    ).rejects.toMatchObject({ reason: 'private_address', redirectTarget: undefined });
  });

  it('attributes a private redirect target to the Location the receiver sent', async () => {
    fetchMock.mockResolvedValueOnce(redirect('http://10.0.0.5:8080/kast'));
    await expect(
      fetchGuarded('https://receiver.example/hook', { method: 'POST' }, { maxBytes: 1024 }),
    ).rejects.toMatchObject({
      reason: 'private_address',
      redirectTarget: 'http://10.0.0.5:8080/kast',
    });
  });

  it('attributes a non-http(s) redirect target to the Location the receiver sent', async () => {
    fetchMock.mockResolvedValueOnce(redirect('mailto:ops@receiver.example'));
    await expect(
      fetchGuarded('https://receiver.example/hook', { method: 'POST' }, { maxBytes: 1024 }),
    ).rejects.toMatchObject({
      reason: 'unsupported_scheme',
      redirectTarget: 'mailto:ops@receiver.example',
    });
  });

  it('attributes an unparsable redirect target raw, exactly as it arrived', async () => {
    fetchMock.mockResolvedValueOnce(redirect('http://['));
    await expect(
      fetchGuarded('https://receiver.example/hook', { method: 'POST' }, { maxBytes: 1024 }),
    ).rejects.toMatchObject({ reason: 'invalid_url', redirectTarget: 'http://[' });
  });

  it('attributes a block on a later hop of a redirect chain', async () => {
    fetchMock
      .mockResolvedValueOnce(redirect('https://cdn.receiver.example/hook'))
      .mockResolvedValueOnce(redirect('http://127.0.0.1:8080/'));
    await expect(
      fetchGuarded('https://receiver.example/hook', { method: 'POST' }, { maxBytes: 1024 }),
    ).rejects.toMatchObject({
      reason: 'private_address',
      redirectTarget: 'http://127.0.0.1:8080/',
    });
  });

  it('attributes a redirect target that fails to resolve', async () => {
    fetchMock.mockResolvedValueOnce(redirect('https://cdn.receiver.example/hook'));
    mockedLookup
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockRejectedValue(new Error('EAI_AGAIN'));
    await expect(
      fetchGuarded('https://receiver.example/hook', { method: 'POST' }, { maxBytes: 1024 }),
    ).rejects.toMatchObject({
      reason: 'dns_failure',
      redirectTarget: 'https://cdn.receiver.example/hook',
    });
  });

  it('never resolves an allow-listed internal target but still fetches it', async () => {
    fetchMock.mockResolvedValue(new Response('internal', { status: 200 }));
    const result = await fetchGuarded(
      'http://127.0.0.1:9000/hook',
      { method: 'POST' },
      { maxBytes: 1024, allowList: ['127.0.0.1'] },
    );
    expect(result.body).toBe('internal');
    expect(mockedLookup).not.toHaveBeenCalled();
  });
});
