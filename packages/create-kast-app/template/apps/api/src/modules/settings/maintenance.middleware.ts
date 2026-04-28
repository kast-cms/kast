import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

const CACHE_TTL_MS = 60_000;

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  private cachedValue: boolean | null = null;
  private cacheExpiry = 0;

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!req.path.includes('/delivery/')) {
      next();
      return;
    }
    const active = await this.isMaintenanceModeActive();
    if (active) {
      res
        .status(503)
        .json({ statusCode: 503, message: 'Service temporarily unavailable (maintenance mode)' });
      return;
    }
    next();
  }

  private async isMaintenanceModeActive(): Promise<boolean> {
    const now = Date.now();
    if (this.cachedValue !== null && now < this.cacheExpiry) {
      return this.cachedValue;
    }
    const setting = await this.prisma.globalSetting.findUnique({
      where: { key: 'site.maintenanceMode' },
    });
    this.cachedValue = setting?.value === true;
    this.cacheExpiry = now + CACHE_TTL_MS;
    return this.cachedValue;
  }
}
