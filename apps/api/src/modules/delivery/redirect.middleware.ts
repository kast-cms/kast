import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

interface CachedRedirect {
  toPath: string;
  statusCode: 301 | 302;
  id: string;
}

const CACHE_TTL_MS = 60_000;

/**
 * Serves active redirect rules. For any incoming request whose path matches an
 * active `Redirect.fromPath`, responds with a 301 (PERMANENT) or 302
 * (TEMPORARY) to `toPath` and increments `hitCount`. The active redirect set is
 * cached in-memory for a short TTL to keep lookups off the hot path.
 */
@Injectable()
export class RedirectMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RedirectMiddleware.name);
  private cache = new Map<string, CachedRedirect>();
  private cacheExpiry = 0;

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Only GET/HEAD navigations are redirect candidates; never intercept API or
    // admin asset traffic.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    const path = this.normalize(req.path);
    if (path.startsWith('/api')) {
      next();
      return;
    }

    const match = await this.lookup(path);
    if (!match) {
      next();
      return;
    }

    // Fire-and-forget hit counter; never block the redirect on the write.
    this.prisma.redirect
      .update({ where: { id: match.id }, data: { hitCount: { increment: 1 } } })
      .catch((err: unknown) =>
        this.logger.warn(`Failed to increment redirect hit: ${String(err)}`),
      );

    res.redirect(match.statusCode, match.toPath);
  }

  private normalize(path: string): string {
    if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
    return path;
  }

  private async lookup(path: string): Promise<CachedRedirect | undefined> {
    await this.refreshIfStale();
    return this.cache.get(path);
  }

  private async refreshIfStale(): Promise<void> {
    const now = Date.now();
    if (this.cache.size > 0 && now < this.cacheExpiry) return;
    if (now < this.cacheExpiry) return;

    const rows = await this.prisma.redirect.findMany({
      where: { isActive: true },
      select: { id: true, fromPath: true, toPath: true, type: true },
    });
    const next = new Map<string, CachedRedirect>();
    for (const r of rows) {
      next.set(this.normalize(r.fromPath), {
        id: r.id,
        toPath: r.toPath,
        statusCode: r.type === 'PERMANENT' ? 301 : 302,
      });
    }
    this.cache = next;
    this.cacheExpiry = now + CACHE_TTL_MS;
  }
}
