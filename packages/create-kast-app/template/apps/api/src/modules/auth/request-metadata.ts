import type { Request } from 'express';
import type { SessionMetadata } from '../../common/types/auth.types';

export function requestMetadata(req: Request): SessionMetadata {
  return {
    userAgent: (req.get('user-agent') ?? '').slice(0, 512),
    ipAddress: (req.ip ?? '').slice(0, 64),
  };
}
