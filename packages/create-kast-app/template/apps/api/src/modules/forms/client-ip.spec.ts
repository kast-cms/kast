import type { Request } from 'express';
import { resolveClientIp } from './client-ip';

function buildRequest(
  ip: string | undefined,
  remoteAddress?: string,
): Pick<Request, 'ip' | 'socket'> {
  return { ip, socket: { remoteAddress } } as unknown as Pick<Request, 'ip' | 'socket'>;
}

describe('resolveClientIp', () => {
  it('uses the address Express resolved through the trust-proxy setting', () => {
    expect(resolveClientIp(buildRequest('203.0.113.7', '10.0.0.1'))).toBe('203.0.113.7');
  });

  it('ignores a forwarded header the app never opted into trusting', () => {
    const req = {
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.1' },
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    } as unknown as Request;

    expect(resolveClientIp(req)).toBe('10.0.0.1');
  });

  it('falls back to the socket peer when Express reports no address', () => {
    expect(resolveClientIp(buildRequest(undefined, '198.51.100.9'))).toBe('198.51.100.9');
  });

  it('unwraps an IPv4-mapped IPv6 address', () => {
    expect(resolveClientIp(buildRequest('::ffff:203.0.113.7'))).toBe('203.0.113.7');
  });

  it('returns undefined when there is no address at all', () => {
    expect(resolveClientIp(buildRequest(undefined, undefined))).toBeUndefined();
    expect(resolveClientIp(buildRequest(''))).toBeUndefined();
  });
});
