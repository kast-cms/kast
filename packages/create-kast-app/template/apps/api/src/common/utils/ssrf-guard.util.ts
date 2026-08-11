// SSRF guard helpers: classify resolved IP addresses so callers can reject
// server-side fetches that target loopback / private / link-local hosts
// (e.g. 127.0.0.1, 169.254.169.254 cloud metadata, RFC1918, ULA, etc.).

import { lookup } from 'dns/promises';
import { isIP } from 'net';

// Loopback / private / reserved IPv4 ranges as [network, mask] integer pairs.
const PRIVATE_V4_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 0xff000000], // 0.0.0.0/8      "this host"
  [0x0a000000, 0xff000000], // 10.0.0.0/8
  [0x7f000000, 0xff000000], // 127.0.0.0/8    loopback
  [0xa9fe0000, 0xffff0000], // 169.254.0.0/16 link-local (incl. 169.254.169.254)
  [0xac100000, 0xfff00000], // 172.16.0.0/12
  [0xc0a80000, 0xffff0000], // 192.168.0.0/16
  [0x64400000, 0xffc00000], // 100.64.0.0/10  CGNAT
  [0xc0000000, 0xffffff00], // 192.0.0.0/24   IETF protocol assignments
  [0xc0000200, 0xffffff00], // 192.0.2.0/24   TEST-NET-1
  [0xc6120000, 0xfffe0000], // 198.18.0.0/15  benchmarking
  [0xc6336400, 0xffffff00], // 198.51.100.0/24 TEST-NET-2
  [0xcb007100, 0xffffff00], // 203.0.113.0/24 TEST-NET-3
  [0xe0000000, 0xf0000000], // 224.0.0.0/4    multicast
  [0xf0000000, 0xf0000000], // 240.0.0.0/4    reserved (incl. 255.255.255.255)
];

// Hostnames that never resolve to public space but that DNS may still answer for.
const INTERNAL_HOST_SUFFIXES = ['.localhost', '.internal', '.local'] as const;

const DEFAULT_MAX_REDIRECTS = 5;

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    n = (n * 256 + octet) >>> 0;
  }
  return n;
}

function isPrivateV4(v4: number): boolean {
  return PRIVATE_V4_RANGES.some(([net, mask]) => (v4 & mask) >>> 0 === net);
}

// IPv6 literals are expanded to 16 raw bytes because classification has to see the
// embedded IPv4 of ::ffff:/64:ff9b::/2002:: in BOTH hex and dotted spelling — a
// textual prefix match only catches the dotted form and lets ::ffff:7f00:1 through.
function stripIpv6Decorations(input: string): string {
  let text = input.toLowerCase();
  const zone = text.indexOf('%');
  if (zone !== -1) text = text.slice(0, zone);
  if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1);
  return text;
}

/** Rewrites a trailing dotted-quad (`::ffff:127.0.0.1`) as two hextets. */
function expandTrailingIpv4(text: string): string | null {
  const lastColon = text.lastIndexOf(':');
  const trailer = text.slice(lastColon + 1);
  if (!trailer.includes('.')) return text;
  const embedded = ipv4ToInt(trailer);
  if (embedded === null) return null;
  const hextets = [(embedded >>> 16) & 0xffff, embedded & 0xffff].map((h) => h.toString(16));
  return `${text.slice(0, lastColon + 1)}${hextets.join(':')}`;
}

function toHextets(part: string): number[] | null {
  if (part === '') return [];
  const groups: number[] = [];
  for (const group of part.split(':')) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    groups.push(parseInt(group, 16));
  }
  return groups;
}

function ipv6Hextets(text: string): number[] | null {
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = toHextets(halves[0] ?? '');
  if (head === null) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const tail = toHextets(halves[1] ?? '');
  if (tail === null) return null;
  if (head.length + tail.length > 7) return null;
  return [...head, ...new Array<number>(8 - head.length - tail.length).fill(0), ...tail];
}

function parseIpv6(input: string): Uint8Array | null {
  const text = stripIpv6Decorations(input);
  if (!text.includes(':')) return null;
  const expanded = expandTrailingIpv4(text);
  if (expanded === null) return null;
  const groups = ipv6Hextets(expanded);
  if (groups === null) return null;

  const bytes = new Uint8Array(16);
  groups.forEach((group, i) => {
    bytes[i * 2] = (group >>> 8) & 0xff;
    bytes[i * 2 + 1] = group & 0xff;
  });
  return bytes;
}

function byteAt(bytes: Uint8Array, index: number): number {
  return bytes[index] ?? 0;
}

function allZero(bytes: Uint8Array, start: number, end: number): boolean {
  for (let i = start; i < end; i++) {
    if (byteAt(bytes, i) !== 0) return false;
  }
  return true;
}

function embeddedV4(bytes: Uint8Array, offset: number): number {
  return [0, 1, 2, 3].reduce((acc, i) => acc * 256 + byteAt(bytes, offset + i), 0);
}

const NAT64_PREFIX = [0x00, 0x64, 0xff, 0x9b] as const; // 64:ff9b::/96
const SIX_TO_FOUR_PREFIX = [0x20, 0x02] as const; // 2002::/16

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((expected, i) => byteAt(bytes, i) === expected);
}

/** The IPv4 address an IPv6 literal tunnels, for the transition ranges that carry one. */
function embeddedV4OfV6(bytes: Uint8Array): number | null {
  // ::ffff:0:0/96 IPv4-mapped and ::/96 IPv4-compatible
  if (allZero(bytes, 0, 10)) {
    const marker = (byteAt(bytes, 10) << 8) | byteAt(bytes, 11);
    if (marker === 0xffff || marker === 0) return embeddedV4(bytes, 12);
  }
  if (hasPrefix(bytes, NAT64_PREFIX) && allZero(bytes, 4, 12)) return embeddedV4(bytes, 12);
  if (hasPrefix(bytes, SIX_TO_FOUR_PREFIX)) return embeddedV4(bytes, 2);
  return null;
}

function isPrivateV6(bytes: Uint8Array): boolean {
  if (allZero(bytes, 0, 15) && byteAt(bytes, 15) <= 1) return true; // :: unspecified / ::1 loopback
  if ((byteAt(bytes, 0) & 0xfe) === 0xfc) return true; // fc00::/7 unique-local
  if (byteAt(bytes, 0) === 0xfe && (byteAt(bytes, 1) & 0xc0) === 0x80) return true; // fe80::/10
  if (byteAt(bytes, 0) === 0xff) return true; // ff00::/8 multicast
  const embedded = embeddedV4OfV6(bytes);
  return embedded !== null && isPrivateV4(embedded);
}

/** True for loopback, private, link-local, ULA, or otherwise non-public IP addresses. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase();
  const v4 = ipv4ToInt(ip);
  if (v4 !== null) return isPrivateV4(v4);
  const bytes = parseIpv6(ip);
  if (bytes !== null) return isPrivateV6(bytes);
  return false;
}

export type BlockedUrlReason =
  | 'invalid_url'
  | 'unsupported_scheme'
  | 'private_address'
  | 'dns_failure'
  | 'too_many_redirects';

/** Thrown by the outbound-URL helpers. Framework-free so callers map it to their own HTTP errors. */
export class BlockedUrlError extends Error {
  constructor(
    readonly reason: BlockedUrlReason,
    message: string,
    /**
     * Set only when the refused target came from a receiver's `Location` header, as
     * it arrived and never as a resolved address. "Your URL is wrong" and "your
     * endpoint bounced us somewhere we refuse to go" are different operator problems,
     * and the reason alone cannot tell them apart.
     */
    readonly redirectTarget?: string,
  ) {
    super(message);
    this.name = 'BlockedUrlError';
  }
}

function normalizeHost(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

/** Parses a comma/space separated allow-list of hostnames (supports `*.example.com`). */
export function parseHostAllowList(raw: string | undefined): string[] {
  if (raw === undefined) return [];
  return raw
    .split(/[\s,]+/)
    .map((entry) => normalizeHost(entry.trim()))
    .filter((entry) => entry.length > 0);
}

/** Exact host match, or `*.suffix` wildcard. Ports are never part of the comparison. */
export function isHostAllowListed(hostname: string, allowList: readonly string[]): boolean {
  const host = normalizeHost(hostname);
  return allowList.some((entry) =>
    entry.startsWith('*.')
      ? host === entry.slice(2) || host.endsWith(entry.slice(1))
      : host === entry,
  );
}

/** Parses an outbound URL, rejecting anything that is not http(s). `via` attributes the
 * verdict to a redirect target when the URL came from a receiver rather than the caller. */
export function parseOutboundUrl(raw: string, via?: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError('invalid_url', 'not a valid absolute URL', via);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedUrlError('unsupported_scheme', 'only http(s) URLs are allowed', via);
  }
  return url;
}

export type OutboundUrlCheck = { ok: true } | { ok: false; reason: BlockedUrlReason };

/** Synchronous, DNS-free half of the policy — safe inside a class-validator constraint. */
export function checkOutboundUrlSyntax(raw: string, allow: readonly string[]): OutboundUrlCheck {
  let url: URL;
  try {
    url = parseOutboundUrl(raw);
  } catch (err) {
    return { ok: false, reason: err instanceof BlockedUrlError ? err.reason : 'invalid_url' };
  }
  const host = normalizeHost(url.hostname);
  if (isHostAllowListed(host, allow)) return { ok: true };
  if (isIP(host) !== 0) {
    return isPrivateAddress(host) ? { ok: false, reason: 'private_address' } : { ok: true };
  }
  if (host === 'localhost' || INTERNAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return { ok: false, reason: 'private_address' };
  }
  return { ok: true };
}

/** Resolves a hostname, failing closed when the resolver errors or answers with nothing. */
async function resolveAll(host: string, redirectTarget?: string): Promise<string[]> {
  const addresses = await lookup(host, { all: true })
    .then((records) => records.map((record) => record.address))
    .catch(() => []);
  if (addresses.length === 0) {
    throw new BlockedUrlError('dns_failure', `could not resolve host ${host}`, redirectTarget);
  }
  return addresses;
}

/**
 * Resolves the host and rejects it unless every returned address is public.
 *
 * Residual risk: a DNS rebind between this lookup and the connection that follows
 * is still possible — Node's global fetch cannot be handed a pinned `lookup`, so
 * closing that window means dropping to node:https with a custom resolver. Same
 * exposure as the media remote-fetch path.
 *
 * `redirectTarget` labels the verdict as being about a target a receiver named
 * rather than one the caller chose; pass it for every hop past the first.
 */
export async function assertPublicUrl(
  url: URL,
  opts: { allowList?: readonly string[]; redirectTarget?: string | undefined } = {},
): Promise<void> {
  const host = normalizeHost(url.hostname);
  const via = opts.redirectTarget;
  if (isHostAllowListed(host, opts.allowList ?? [])) return;
  const addresses = isIP(host) !== 0 ? [host] : await resolveAll(host, via);
  if (addresses.some((address) => isPrivateAddress(address))) {
    throw new BlockedUrlError('private_address', `host ${host} resolves to a private address`, via);
  }
}

export interface GuardedResponse {
  status: number;
  ok: boolean;
  body: string;
  truncated: boolean;
  finalUrl: string;
}

export interface FetchGuardedOptions {
  allowList?: readonly string[];
  maxRedirects?: number;
  maxBytes: number;
  timeoutMs?: number;
}

/** Reads at most `maxBytes` from the response, then cancels the stream. */
async function readBoundedBody(
  res: Response,
  maxBytes: number,
): Promise<{ body: string; truncated: boolean }> {
  const stream = res.body as ReadableStream<Uint8Array> | null;
  if (!stream) return { body: '', truncated: false };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maxBytes - total;
      if (value.byteLength > remaining) {
        if (remaining > 0) chunks.push(value.subarray(0, remaining));
        total += Math.max(remaining, 0);
        truncated = true;
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } catch {
    // A torn stream still leaves whatever was already read worth recording.
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return { body: Buffer.concat(chunks, total).toString('utf8'), truncated };
}

/**
 * Fetches a URL with the egress policy applied to the initial target AND to every
 * redirect hop, and with the response body bounded by bytes. Redirects are handled
 * manually: `redirect: 'follow'` would let a public host bounce the request into
 * internal space with no revalidation.
 */
function redirectLocation(res: Response): string | null {
  if (res.status < 300 || res.status >= 400) return null;
  return res.headers.get('location');
}

/** Every verdict here is about `location`, which the receiver chose, so all of them carry it. */
function resolveRedirect(location: string, current: URL): URL {
  let next: URL;
  try {
    next = new URL(location, current);
  } catch {
    throw new BlockedUrlError('invalid_url', 'redirect target is not a valid URL', location);
  }
  return parseOutboundUrl(next.toString(), location);
}

export async function fetchGuarded(
  url: string,
  init: RequestInit,
  opts: FetchGuardedOptions,
): Promise<GuardedResponse> {
  const maxRedirects = opts.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const timeoutSignal =
    opts.timeoutMs === undefined ? undefined : AbortSignal.timeout(opts.timeoutMs);
  const requestInit: RequestInit = {
    ...init,
    redirect: 'manual',
    ...(timeoutSignal ? { signal: timeoutSignal } : {}),
  };
  let target = parseOutboundUrl(url);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const via = hop === 0 ? undefined : target.toString();
    await assertPublicUrl(target, { allowList: opts.allowList ?? [], redirectTarget: via });
    const res = await fetch(target, requestInit);
    const location = redirectLocation(res);
    if (location === null) {
      const { body, truncated } = await readBoundedBody(res, opts.maxBytes);
      return { status: res.status, ok: res.ok, body, truncated, finalUrl: target.toString() };
    }
    await res.body?.cancel().catch(() => undefined);
    target = resolveRedirect(location, target);
  }
  throw new BlockedUrlError('too_many_redirects', `more than ${maxRedirects} redirects`);
}
