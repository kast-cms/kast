import { isPrivateAddress } from './ssrf-guard.util';

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
});
