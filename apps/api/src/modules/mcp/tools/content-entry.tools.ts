import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../common/types/auth.types';
import { ContentService } from '../../content/content.service';
import { McpTool } from '../mcp-tool.decorator';

const ENTRY_SCHEMA_REQUIRED = ['typeSlug', 'entryId'];

@Injectable()
export class McpContentEntryTools {
  constructor(private readonly contentService: ContentService) {}

  @McpTool({
    name: 'list_content_entries',
    description: 'List entries for a type, with filter and pagination',
    role: 'viewer',
    inputSchema: {
      type: 'object',
      properties: {
        typeSlug: { type: 'string' },
        limit: { type: 'number' },
        cursor: { type: 'string' },
        locale: { type: 'string' },
      },
      required: ['typeSlug'],
    },
    dryRunable: false,
  })
  async listContentEntries(args: Record<string, unknown>, _user: AuthUser): Promise<unknown> {
    const { typeSlug, ...query } = args;
    return this.contentService.findAll(
      typeSlug as string,
      query as Parameters<ContentService['findAll']>[1],
    );
  }

  @McpTool({
    name: 'get_content_entry',
    description: 'Get a single content entry with all locale data',
    role: 'viewer',
    inputSchema: {
      type: 'object',
      properties: {
        typeSlug: { type: 'string' },
        entryId: { type: 'string' },
        locale: { type: 'string' },
      },
      required: ENTRY_SCHEMA_REQUIRED,
    },
    dryRunable: false,
  })
  async getContentEntry(args: Record<string, unknown>, _user: AuthUser): Promise<unknown> {
    return this.contentService.findOne(
      args['typeSlug'] as string,
      args['entryId'] as string,
      args['locale'] as string | undefined,
    );
  }

  @McpTool({
    name: 'create_content_entry',
    description: 'Create a new entry (status = DRAFT)',
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: {
        typeSlug: { type: 'string' },
        locale: { type: 'string' },
        data: { type: 'object' },
      },
      required: ['typeSlug', 'data'],
    },
    dryRunable: true,
  })
  async createContentEntry(args: Record<string, unknown>, user: AuthUser): Promise<unknown> {
    return this.contentService.create(
      args['typeSlug'] as string,
      {
        locale: (args['locale'] as string | undefined) ?? 'en',
        data: args['data'] as Record<string, unknown>,
      },
      user.id,
    );
  }

  @McpTool({
    name: 'update_content_entry',
    description: 'Update entry fields by entry ID',
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: {
        typeSlug: { type: 'string' },
        entryId: { type: 'string' },
        data: { type: 'object' },
        status: { type: 'string' },
      },
      required: ENTRY_SCHEMA_REQUIRED,
    },
    dryRunable: true,
  })
  async updateContentEntry(args: Record<string, unknown>, user: AuthUser): Promise<unknown> {
    const updateData = args['data'] as Record<string, unknown> | undefined;
    const updateStatus = args['status'] as Parameters<ContentService['update']>[2]['status'];
    const dto = {
      ...(updateData !== undefined ? { data: updateData } : {}),
      ...(updateStatus !== undefined ? { status: updateStatus } : {}),
    };
    return this.contentService.update(
      args['typeSlug'] as string,
      args['entryId'] as string,
      dto,
      user.id,
    );
  }

  @McpTool({
    name: 'publish_content_entry',
    description: 'Publish or unpublish a content entry',
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: {
        typeSlug: { type: 'string' },
        entryId: { type: 'string' },
      },
      required: ENTRY_SCHEMA_REQUIRED,
    },
    dryRunable: false,
  })
  async publishContentEntry(args: Record<string, unknown>, _user: AuthUser): Promise<unknown> {
    return this.contentService.publish(args['typeSlug'] as string, args['entryId'] as string);
  }

  @McpTool({
    name: 'delete_content_entry',
    description: 'Soft-delete (trash) a content entry',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: {
        typeSlug: { type: 'string' },
        entryId: { type: 'string' },
      },
      required: ENTRY_SCHEMA_REQUIRED,
    },
    dryRunable: false,
  })
  async deleteContentEntry(args: Record<string, unknown>, _user: AuthUser): Promise<unknown> {
    await this.contentService.trash(args['typeSlug'] as string, args['entryId'] as string);
    return { deleted: true };
  }
}
