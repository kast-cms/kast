import { Injectable } from '@nestjs/common';
import type { PaginationDto } from '../../../common/dto/pagination.dto';
import type { AuthUser } from '../../../common/types/auth.types';
import { AuditService } from '../../audit/audit.service';
import type { AuditQueryDto } from '../../audit/dto/audit-query.dto';
import { MediaService } from '../../media/media.service';
import { SeoService } from '../../seo/seo.service';
import { McpTool } from '../mcp-tool.decorator';

@Injectable()
export class McpMediaSeoAuditTools {
  constructor(
    private readonly mediaService: MediaService,
    private readonly seoService: SeoService,
    private readonly auditService: AuditService,
  ) {}

  @McpTool({
    name: 'list_media',
    description: 'List media files with optional folder filter',
    role: 'viewer',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        cursor: { type: 'string' },
      },
    },
    dryRunable: false,
  })
  async listMedia(args: Record<string, unknown>, _user: AuthUser): Promise<unknown> {
    return this.mediaService.findAll(args as PaginationDto);
  }

  @McpTool({
    name: 'get_media_file',
    description: 'Get metadata for a single media file',
    role: 'viewer',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    dryRunable: false,
  })
  async getMediaFile(args: Record<string, unknown>, _user: AuthUser): Promise<unknown> {
    return this.mediaService.findById(args['id'] as string);
  }

  @McpTool({
    name: 'get_seo_score',
    description: 'Get the latest SEO score and issues for an entry',
    role: 'viewer',
    inputSchema: {
      type: 'object',
      properties: { entryId: { type: 'string' } },
      required: ['entryId'],
    },
    dryRunable: false,
  })
  async getSeoScore(args: Record<string, unknown>, _user: AuthUser): Promise<unknown> {
    return this.seoService.getScore(args['entryId'] as string);
  }

  @McpTool({
    name: 'validate_seo',
    description: 'Trigger SEO validation job and return queue status',
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: { entryId: { type: 'string' } },
      required: ['entryId'],
    },
    dryRunable: false,
  })
  async validateSeo(args: Record<string, unknown>, _user: AuthUser): Promise<unknown> {
    return this.seoService.enqueueValidation(args['entryId'] as string);
  }

  @McpTool({
    name: 'get_audit_log',
    description: 'Query the audit log with optional filters',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        resource: { type: 'string' },
        userId: { type: 'string' },
        from: { type: 'string', format: 'date-time' },
        to: { type: 'string', format: 'date-time' },
        limit: { type: 'number' },
        cursor: { type: 'string' },
      },
    },
    dryRunable: false,
  })
  async getAuditLog(args: Record<string, unknown>, _user: AuthUser): Promise<unknown> {
    return this.auditService.findAll(args as AuditQueryDto);
  }
}
