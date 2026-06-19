// SSRF guard helpers: classify resolved IP addresses so callers can reject
// server-side fetches that target loopback / private / link-local hosts
// (e.g. 127.0.0.1, 169.254.169.254 cloud metadata, RFC1918, ULA, etc.).

// Loopback / private / reserved IPv4 ranges as [network, mask] integer pairs.
const PRIVATE_V4_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 0xff000000], // 0.0.0.0/8      "this host"
  [0x0a000000, 0xff000000], // 10.0.0.0/8
  [0x7f000000, 0xff000000], // 127.0.0.0/8    loopback
  [0xa9fe0000, 0xffff0000], // 169.254.0.0/16 link-local (incl. 169.254.169.254)
  [0xac100000, 0xfff00000], // 172.16.0.0/12
  [0xc0a80000, 0xffff0000], // 192.168.0.0/16
  [0x64400000, 0xffc00000], // 100.64.0.0/10  CGNAT
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    n = (n * 256 + octet) >>> 0;
  }
  return n;
}

/** True for loopback, private, link-local, ULA, or otherwise non-public IP addresses. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase();
  const v4 = ipv4ToInt(ip.startsWith('::ffff:') ? ip.slice(7) : ip);
  if (v4 !== null) {
    return PRIVATE_V4_RANGES.some(([net, mask]) => (v4 & mask) >>> 0 === net);
  }
  if (ip === '::1' || ip === '::') return true; // loopback / unspecified
  if (/^f[cd]/.test(ip)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(ip)) return true; // fe80::/10 link-local
  return false;
}
