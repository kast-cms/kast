import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SeoRepository } from './seo.repository';

const DEFAULT_ROBOTS = `User-agent: *\nAllow: /\n`;
const CACHE_TTL_MS = 60_000;

@ApiTags('seo')
@Controller({ path: 'robots.txt', version: '1' })
export class RobotsController {
  private cached: string | null = null;
  private cacheExpiry = 0;

  constructor(private readonly repo: SeoRepository) {}

  /** Serves the saved `robots.txt` setting verbatim, falling back to allow-all. */
  @Get()
  @Public()
  @Header('Content-Type', 'text/plain')
  @ApiOperation({ summary: 'Serve robots.txt' })
  async getRobots(): Promise<string> {
    const now = Date.now();
    if (this.cached !== null && now < this.cacheExpiry) return this.cached;

    const stored = await this.repo.findRobotsTxt();
    this.cached = stored === null ? DEFAULT_ROBOTS : `${stored.trimEnd()}\n`;
    this.cacheExpiry = now + CACHE_TTL_MS;
    return this.cached;
  }
}
