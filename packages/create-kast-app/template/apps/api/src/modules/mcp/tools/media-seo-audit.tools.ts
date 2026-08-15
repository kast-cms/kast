import { Injectable } from '@nestjs/common';
import type { PaginationDto } from '../../../common/dto/pagination.dto';
import type { AuthUser } from '../../../common/types/auth.types';
import { AuditService } from '../../audit/audit.service';
import type { AuditQueryDto } from '../../audit/dto/audit-query.dto';
import { MediaService } from '../../media/media.service';
import type { CreateRedirectDto } from '../../seo/dto/redirect.dto';
import { SeoService } from '../../seo/seo.service';
import { McpTool } from '../mcp-tool.decorator';
import type { ToolContext } from '../types/mcp.types';

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
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        cursor: { type: 'string' },
      },
    },
    dryRunable: false,
  })
  async listMedia(
    args: Record<string, unknown>,
    _user: AuthUser,
    _ctx: ToolContext,
  ): Promise<unknown> {
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
  async getMediaFile(
    args: Record<string, unknown>,
    _user: AuthUser,
    _ctx: ToolContext,
  ): Promise<unknown> {
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
  async getSeoScore(
    args: Record<string, unknown>,
    _user: AuthUser,
    _ctx: ToolContext,
  ): Promise<unknown> {
    return this.seoService.getScore(args['entryId'] as string);
  }

  @McpTool({
    name: 'validate_seo',
    description: 'Trigger SEO validation job and return queue status',
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: { entryId: { type: 'string' }, dryRun: { type: 'boolean' } },
      required: ['entryId'],
    },
    dryRunable: true,
  })
  async validateSeo(
    args: Record<string, unknown>,
    _user: AuthUser,
    ctx: ToolContext,
  ): Promise<unknown> {
    if (ctx.dryRun) {
      return { action: 'validate_seo', entryId: args['entryId'], wouldQueue: true };
    }
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
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        cursor: { type: 'string' },
      },
    },
    dryRunable: false,
  })
  async getAuditLog(
    args: Record<string, unknown>,
    _user: AuthUser,
    _ctx: ToolContext,
  ): Promise<unknown> {
    return this.auditService.findAll(args as AuditQueryDto);
  }

  @McpTool({
    name: 'upload_media_from_url',
    description:
      'Fetch a remote file and store it as media. The URL goes through the same SSRF guard ' +
      'and MIME allow-list as the REST upload-from-URL route.',
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', format: 'uri' },
        folderId: { type: 'string' },
        altText: { type: 'string' },
        dryRun: { type: 'boolean' },
      },
      required: ['url'],
    },
    dryRunable: true,
  })
  async uploadMediaFromUrl(
    args: Record<string, unknown>,
    user: AuthUser,
    ctx: ToolContext,
  ): Promise<unknown> {
    const url = args['url'] as string;
    if (ctx.dryRun) {
      // Resolves and screens the URL without fetching the body, so the preview
      // fails on a blocked host exactly as the real call would.
      return {
        action: 'upload_media_from_url',
        url,
        ...(await this.mediaService.previewUploadFromUrl(url)),
      };
    }
    return this.mediaService.uploadFromUrl(url, user.id, {
      ...(args['folderId'] !== undefined ? { folderId: args['folderId'] as string } : {}),
      ...(args['altText'] !== undefined ? { altText: args['altText'] as string } : {}),
    });
  }

  @McpTool({
    name: 'create_redirect',
    description: 'Create an SEO redirect from one path to another',
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: {
        fromPath: { type: 'string' },
        toPath: { type: 'string' },
        type: { type: 'string', enum: ['PERMANENT', 'TEMPORARY'] },
        dryRun: { type: 'boolean' },
      },
      required: ['fromPath', 'toPath'],
    },
    dryRunable: true,
  })
  async createRedirect(
    args: Record<string, unknown>,
    user: AuthUser,
    ctx: ToolContext,
  ): Promise<unknown> {
    const dto = args as unknown as CreateRedirectDto;
    if (ctx.dryRun) {
      // The same open-redirect policy the write applies, so a preview cannot
      // report a create the real call would refuse.
      await this.seoService.assertRedirectTargetAllowed(dto.toPath);
      return {
        action: 'create_redirect',
        wouldCreate: true,
        fromPath: dto.fromPath,
        toPath: dto.toPath,
      };
    }
    return this.seoService.createRedirect(dto, user.id);
  }
}
