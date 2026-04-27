import { Controller, Get, HttpException, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

interface MeilisearchSearchResult {
  hits: unknown[];
  query: string;
  processingTimeMs: number;
  limit: number;
  offset: number;
  estimatedTotalHits: number;
}

interface SearchResponse {
  data: {
    hits: unknown[];
    query: string;
    total: number;
    limit: number;
    offset: number;
    processingTimeMs: number;
  };
}

@ApiTags('search')
@Controller({ path: 'search', version: '1' })
export class SearchController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'Full-text search via Meilisearch (requires kast-plugin-meilisearch)' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'type', required: false, description: 'Content type slug' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results per page (max 100)',
  })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async search(
    @Query('q') q: string,
    @Query('type') type?: string,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ): Promise<SearchResponse> {
    const host = process.env['MEILISEARCH_HOST'];
    const masterKey = process.env['MEILISEARCH_MASTER_KEY'];

    if (!host || !masterKey) {
      throw new HttpException(
        'Search is not configured. Install kast-plugin-meilisearch.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const prefix = process.env['MEILISEARCH_INDEX_PREFIX'] ?? 'kast_';
    const indexName = type ? `${prefix}${type}` : `${prefix}content`;
    const safeLimit = Math.min(Number(limit), 100);
    const safeOffset = Math.max(Number(offset), 0);
    const result = await this.fetchFromMeilisearch(
      host,
      masterKey,
      indexName,
      q,
      safeLimit,
      safeOffset,
    );

    return {
      data: {
        hits: result.hits,
        query: result.query,
        total: result.estimatedTotalHits,
        limit: result.limit,
        offset: result.offset,
        processingTimeMs: result.processingTimeMs,
      },
    };
  }

  private async fetchFromMeilisearch(
    host: string,
    masterKey: string,
    indexName: string,
    q: string,
    safeLimit: number,
    safeOffset: number,
  ): Promise<MeilisearchSearchResult> {
    const res = await fetch(`${host.replace(/\/$/, '')}/indexes/${indexName}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterKey}` },
      body: JSON.stringify({ q, limit: safeLimit, offset: safeOffset }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new HttpException(`Search error: ${text}`, HttpStatus.BAD_GATEWAY);
    }

    return (await res.json()) as MeilisearchSearchResult;
  }
}
