import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../common/types/auth.types';
import { ContentTypesService } from '../../content-types/content-types.service';
import { ContentService } from '../../content/content.service';
import {
  ContentWriteGate,
  type DryRunValidateOptions,
} from '../../content/validation/content-write.gate';
import { McpTool } from '../mcp-tool.decorator';
import type { ToolContext } from '../types/mcp.types';

const ENTRY_SCHEMA_REQUIRED = ['typeSlug', 'entryId'];

@Injectable()
export class McpContentEntryTools {
  constructor(
    private readonly contentService: ContentService,
    private readonly contentTypes: ContentTypesService,
    private readonly gate: ContentWriteGate,
  ) {}

  /**
   * Validates a payload exactly as the real write would, without persisting.
   * A dry run that skipped this reported success for payloads the write
   * rejects, which is the one thing a dry run must never do.
   */
  private async assertPayloadValid(
    typeSlug: string,
    data: Record<string, unknown>,
    options: DryRunValidateOptions,
  ): Promise<void> {
    const ct = await this.contentTypes.findByName(typeSlug);
    await this.gate.validateStandalone(ct, data, options);
  }

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
  async listContentEntries(
    args: Record<string, unknown>,
    _user: AuthUser,
    _ctx: ToolContext,
  ): Promise<unknown> {
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
  async getContentEntry(
    args: Record<string, unknown>,
    _user: AuthUser,
    _ctx: ToolContext,
  ): Promise<unknown> {
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
        dryRun: { type: 'boolean' },
      },
      required: ['typeSlug', 'data'],
    },
    dryRunable: true,
  })
  async createContentEntry(
    args: Record<string, unknown>,
    user: AuthUser,
    ctx: ToolContext,
  ): Promise<unknown> {
    const dto = {
      locale: (args['locale'] as string | undefined) ?? 'en',
      data: args['data'] as Record<string, unknown>,
    };
    if (ctx.dryRun) {
      await this.assertPayloadValid(args['typeSlug'] as string, dto.data, {
        locale: dto.locale,
        mode: 'draft',
      });
      return { action: 'create_content_entry', typeSlug: args['typeSlug'], wouldCreate: dto };
    }
    return this.contentService.create(args['typeSlug'] as string, dto, user.id);
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
        dryRun: { type: 'boolean' },
      },
      required: ENTRY_SCHEMA_REQUIRED,
    },
    dryRunable: true,
  })
  async updateContentEntry(
    args: Record<string, unknown>,
    user: AuthUser,
    ctx: ToolContext,
  ): Promise<unknown> {
    const updateData = args['data'] as Record<string, unknown> | undefined;
    const updateStatus = args['status'] as Parameters<ContentService['update']>[2]['status'];
    const dto = {
      ...(updateData !== undefined ? { data: updateData } : {}),
      ...(updateStatus !== undefined ? { status: updateStatus } : {}),
    };
    if (ctx.dryRun) {
      if (updateData !== undefined) {
        const dryRunLocale = args['locale'] as string | undefined;
        // Delegated to the service rather than re-derived here: the mode depends on
        // the entry's stored status, which only the service can see, and a mirror of
        // that rule would go stale the moment the write path changed.
        await this.contentService.validateUpdateWithoutWriting(
          args['typeSlug'] as string,
          args['entryId'] as string,
          { ...dto, ...(dryRunLocale !== undefined ? { locale: dryRunLocale } : {}) },
        );
      }
      return {
        action: 'update_content_entry',
        entryId: args['entryId'],
        wouldUpdate: dto,
      };
    }
    return this.contentService.update(
      args['typeSlug'] as string,
      args['entryId'] as string,
      dto,
      user.id,
    );
  }

  @McpTool({
    name: 'publish_content_entry',
    description: 'Publish a content entry (runs the SEO gate)',
    role: 'editor',
    inputSchema: {
      type: 'object',
      properties: {
        typeSlug: { type: 'string' },
        entryId: { type: 'string' },
        force: { type: 'boolean' },
        dryRun: { type: 'boolean' },
      },
      required: ENTRY_SCHEMA_REQUIRED,
    },
    dryRunable: true,
  })
  async publishContentEntry(
    args: Record<string, unknown>,
    _user: AuthUser,
    ctx: ToolContext,
  ): Promise<unknown> {
    if (ctx.dryRun) {
      return { action: 'publish_content_entry', entryId: args['entryId'], wouldPublish: true };
    }
    return this.contentService.publish(args['typeSlug'] as string, args['entryId'] as string, {
      force: (args['force'] as boolean | undefined) ?? false,
    });
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
        dryRun: { type: 'boolean' },
      },
      required: ENTRY_SCHEMA_REQUIRED,
    },
    dryRunable: true,
  })
  async deleteContentEntry(
    args: Record<string, unknown>,
    _user: AuthUser,
    ctx: ToolContext,
  ): Promise<unknown> {
    if (ctx.dryRun) {
      return { action: 'delete_content_entry', entryId: args['entryId'], wouldTrash: true };
    }
    await this.contentService.trash(args['typeSlug'] as string, args['entryId'] as string);
    return { deleted: true };
  }
}
