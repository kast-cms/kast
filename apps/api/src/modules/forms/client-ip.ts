import type { Request } from 'express';

const MAX_IP_LENGTH = 45;

/**
 * Express resolves `req.ip` through the app's `trust proxy` setting, so a
 * forwarded header is honoured only where the deployment declared its proxy.
 * Reading `x-forwarded-for` directly would let any caller choose the address
 * that gets stored against its own submission.
 */
export function resolveClientIp(req: Pick<Request, 'ip' | 'socket'>): string | undefined {
  const raw = req.ip ?? req.socket.remoteAddress;
  if (typeof raw !== 'string') return undefined;
  const value = raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw;
  return value === '' ? undefined : value.slice(0, MAX_IP_LENGTH);
}
