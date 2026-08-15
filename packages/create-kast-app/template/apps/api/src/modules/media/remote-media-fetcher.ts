import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { extname } from 'path';
import { validateMagicBytes } from '../../common/utils/mime-magic.util';
import { isPrivateAddress } from '../../common/utils/ssrf-guard.util';
import { readBoundedBody } from './remote-body.util';

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 15_000;

function parseHttpUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('Only http(s) URLs are supported');
  }
  return parsed;
}

async function assertPublicUrl(parsed: URL): Promise<void> {
  const host = parsed.hostname
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^\[|\]$/g, '');
  let addresses: string[];
  if (isIP(host) !== 0) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true })).map((record) => record.address);
    } catch {
      throw new BadRequestException('Could not resolve URL host');
    }
  }
  if (addresses.length === 0 || addresses.some((address) => isPrivateAddress(address))) {
    throw new BadRequestException('URL host is not allowed');
  }
}

async function fetchGuarded(initialUrl: string): Promise<Response> {
  let target = parseHttpUrl(initialUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicUrl(target);
    let response: Response;
    try {
      response = await fetch(target, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: 'manual',
      });
    } catch (err: unknown) {
      throw new UnprocessableEntityException(`Failed to fetch URL: ${String(err)}`);
    }
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get('location');
    if (location === null) return response;
    target = parseHttpUrl(new URL(location, target).toString());
  }
  throw new UnprocessableEntityException('Too many redirects while fetching the URL');
}

function fileNameFromUrl(parsed: URL, mimeType: string): string {
  const base = parsed.pathname.split('/').filter(Boolean).pop() ?? 'download';
  if (extname(base)) return base;
  const extByMime: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'application/pdf': '.pdf',
  };
  return `${base}${extByMime[mimeType] ?? ''}`;
}

/**
 * Screens a URL the way {@link fetchRemoteMedia} does — scheme, then DNS
 * resolution against the private-address guard — without opening the body.
 * Lets a dry run be refused for a blocked host without transferring anything.
 */
export async function assertRemoteMediaUrlAllowed(url: string): Promise<{ host: string }> {
  const parsed = parseHttpUrl(url);
  await assertPublicUrl(parsed);
  return { host: parsed.hostname };
}

/** Downloads a remote file with bounded redirects, SSRF checks, size, MIME, and magic validation. */
export async function fetchRemoteMedia(
  url: string,
  allowedMimes: ReadonlySet<string>,
  maxBytes: number,
): Promise<{ buffer: Buffer; mimeType: string; originalName: string }> {
  const parsed = parseHttpUrl(url);
  const response = await fetchGuarded(url);
  if (!response.ok) {
    throw new UnprocessableEntityException(`Remote returned ${response.status} for the URL`);
  }
  const mimeType = (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '';
  if (!allowedMimes.has(mimeType)) {
    throw new UnprocessableEntityException(`MIME type ${mimeType || 'unknown'} is not allowed`);
  }
  const buffer = await readBoundedBody(response, maxBytes);
  if (!validateMagicBytes(buffer, mimeType)) {
    throw new UnprocessableEntityException(
      'File type mismatch: magic bytes do not match content-type',
    );
  }
  return { buffer, mimeType, originalName: fileNameFromUrl(parsed, mimeType) };
}
