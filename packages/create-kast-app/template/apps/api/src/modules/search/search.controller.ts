import { Controller, Get, HttpException, HttpStatus, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { SearchQueryDto } from './dto/search-query.dto';

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
  // Authenticated: the Meilisearch index carries `status`, so drafts,
  // scheduled and archived entries are reachable through search. The public
  // read surface is /api/v1/delivery only.
  @Get()
  @ApiBearerAuth()
  @Roles(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  @ApiOperation({ summary: 'Full-text search via Meilisearch (requires kast-plugin-meilisearch)' })
  async search(@Query() query: SearchQueryDto): Promise<SearchResponse> {
    const { q, type } = query;
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
    const safeLimit = query.limit ?? 20;
    const safeOffset = query.offset ?? 0;
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
