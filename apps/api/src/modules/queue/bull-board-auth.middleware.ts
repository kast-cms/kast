import type { NextFunction, Request, Response } from 'express';
import { verify, type JwtPayload as JwtVerifyPayload } from 'jsonwebtoken';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import type { JwtPayload } from '../../common/types/auth.types';

function parseCookieHeader(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const found = header.split(';').find((c) => c.trim().startsWith(`${name}=`));
  return found?.trim().slice(name.length + 1);
}

export function createBullBoardAuthMiddleware(
  jwtSecret: string,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const cookieToken = parseCookieHeader(req.headers.cookie, 'kast_bull');
    const token = cookieToken;

    if (!token) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    try {
      const payload = verify(token, jwtSecret) as JwtVerifyPayload & JwtPayload;
      const roles: string[] = Array.isArray(payload.roles) ? payload.roles : [];

      if (!roles.includes(SYSTEM_ROLES.SUPER_ADMIN)) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }

      next();
    } catch {
      res.status(401).json({ message: 'Unauthorized' });
    }
  };
}
