import type { NextFunction, Request, Response } from 'express';
import { verify, type JwtPayload as JwtVerifyPayload } from 'jsonwebtoken';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import type { JwtPayload } from '../../common/types/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';

function parseCookieHeader(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  const found = header.split(';').find((c) => c.trim().startsWith(`${name}=`));
  return found?.trim().slice(name.length + 1);
}

export function createBullBoardAuthMiddleware(
  jwtSecret: string,
  prisma: PrismaService,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const cookieToken = parseCookieHeader(req.headers.cookie, 'kast_bull');
    const token = cookieToken;

    if (!token) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    try {
      const payload = verify(token, jwtSecret) as JwtVerifyPayload & JwtPayload;
      const session = payload.sid
        ? await prisma.refreshToken.findFirst({
            where: {
              id: payload.sid,
              userId: payload.sub,
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
            include: { user: { include: { roles: { include: { role: true } } } } },
          })
        : null;
      if (!session?.user.isActive || session.user.trashedAt) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }
      const roles = session.user.roles.map(({ role }) => role.name);

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
