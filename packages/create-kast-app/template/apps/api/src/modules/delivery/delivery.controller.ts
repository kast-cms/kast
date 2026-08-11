import { Controller, Get, Header, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SortOrder } from '../../common/dto/pagination.dto';
import type { PaginatedResult } from '../../common/types/auth.types';
import type { MenuDetail } from '../menus/menu.repository';
import { CacheOnSuccessInterceptor } from './cache-on-success.interceptor';
import { DeliveryService, type DeliveryEntry, type DeliveryTypeSchema } from './delivery.service';

const SCHEMA_CACHE_CONTROL = 'public, max-age=60';

@ApiTags('delivery')
@Public()
@Controller({ path: 'delivery', version: '1' })
export class DeliveryController {
  constructor(private readonly service: DeliveryService) {}

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  @ApiOperation({ summary: 'Public sitemap.xml with hreflang alternates' })
  getSitemap(): Promise<string> {
    return this.service.getSitemap();
  }

  @Get('settings')
  @ApiOperation({ summary: 'Public settings subset' })
  getSettings(): Promise<{ data: Record<string, unknown> }> {
    return this.service.getPublicSettings();
  }

  @Get('schema')
  @UseInterceptors(new CacheOnSuccessInterceptor(SCHEMA_CACHE_CONTROL))
  @ApiOperation({ summary: 'Public field schema for every content type' })
  listSchemas(): Promise<{ data: DeliveryTypeSchema[] }> {
    return this.service.listSchemas();
  }

  @Get('schema/:type')
  @UseInterceptors(new CacheOnSuccessInterceptor(SCHEMA_CACHE_CONTROL))
  @ApiOperation({ summary: 'Public field schema for a single content type' })
  getSchema(@Param('type') type: string): Promise<{ data: DeliveryTypeSchema }> {
    return this.service.getSchema(type);
  }

  @Get('menus/:slug')
  @ApiOperation({ summary: 'Public menu tree by slug' })
  getMenu(@Param('slug') slug: string): Promise<{ data: MenuDetail }> {
    return this.service.getMenu(slug);
  }

  @Get('content/:type')
  @ApiOperation({ summary: 'List published entries of a content type' })
  listContent(
    @Param('type') type: string,
    @Query('locale') locale: string | undefined,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('order') order?: string,
  ): Promise<PaginatedResult<DeliveryEntry>> {
    const take = this.parseLimit(limit);
    return this.service.listContent(type, locale, take, this.parseOrder(order), cursor);
  }

  @Get('content/:type/:slug')
  @ApiOperation({ summary: 'Get a single published entry by slug + locale' })
  getContent(
    @Param('type') type: string,
    @Param('slug') slug: string,
    @Query('locale') locale: string | undefined,
  ): Promise<{ data: DeliveryEntry }> {
    return this.service.getContentBySlug(type, slug, locale);
  }

  // The global ValidationPipe does not touch primitive @Query params, so an
  // unknown value would reach Prisma's orderBy and surface as a 500.
  private parseOrder(raw?: string): SortOrder {
    return raw === SortOrder.ASC ? SortOrder.ASC : SortOrder.DESC;
  }

  private parseLimit(raw?: string): number {
    const n = Number(raw ?? 20);
    if (!Number.isFinite(n) || n < 1) return 20;
    return Math.min(Math.trunc(n), 100);
  }
}
