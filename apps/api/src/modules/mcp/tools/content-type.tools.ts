import { Injectable } from '@nestjs/common';
import { ContentFieldType } from '@prisma/client';
import type { AuthUser } from '../../../common/types/auth.types';
import { ContentTypesService } from '../../content-types/content-types.service';
import type {
  CreateContentTypeDto,
  CreateFieldDto,
  UpdateContentTypeDto,
} from '../../content-types/dto/content-type.dto';
import { McpTool } from '../mcp-tool.decorator';
import type { ToolContext } from '../types/mcp.types';

/** The advertised enum comes from Prisma, so it cannot drift from what writes accept. */
const CONTENT_FIELD_TYPES = Object.values(ContentFieldType);

@Injectable()
export class McpContentTypeTools {
  constructor(private readonly contentTypesService: ContentTypesService) {}

  @McpTool({
    name: 'list_content_types',
    description: 'List all content type definitions',
    role: 'viewer',
    inputSchema: { type: 'object', properties: {} },
    dryRunable: false,
  })
  async listContentTypes(
    _args: Record<string, unknown>,
    _user: AuthUser,
    _ctx: ToolContext,
  ): Promise<unknown> {
    return this.contentTypesService.findAll();
  }

  @McpTool({
    name: 'get_content_type',
    description: 'Get a single content type with its fields',
    role: 'viewer',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Content type name / slug' } },
      required: ['name'],
    },
    dryRunable: false,
  })
  async getContentType(
    args: Record<string, unknown>,
    _user: AuthUser,
    _ctx: ToolContext,
  ): Promise<unknown> {
    return this.contentTypesService.findByName(args['name'] as string);
  }

  @McpTool({
    name: 'create_content_type',
    description: 'Create a new content type with fields',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        displayName: { type: 'string' },
        description: { type: 'string' },
        icon: { type: 'string' },
        isLocalized: { type: 'boolean' },
        isPubliclyDiscoverable: { type: 'boolean' },
        dryRun: { type: 'boolean' },
      },
      required: ['name', 'displayName'],
    },
    dryRunable: true,
  })
  async createContentType(
    args: Record<string, unknown>,
    _user: AuthUser,
    ctx: ToolContext,
  ): Promise<unknown> {
    if (ctx.dryRun) {
      return {
        action: 'create_content_type',
        wouldCreate: await this.contentTypesService.previewCreate(
          args as unknown as CreateContentTypeDto,
        ),
      };
    }
    return this.contentTypesService.create(args as unknown as CreateContentTypeDto);
  }

  @McpTool({
    name: 'update_content_type',
    description: 'Update a content type name/description/fields',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Current content type name' },
        displayName: { type: 'string' },
        description: { type: 'string' },
        icon: { type: 'string' },
        isLocalized: { type: 'boolean' },
        isPubliclyDiscoverable: { type: 'boolean' },
        dryRun: { type: 'boolean' },
      },
      required: ['name'],
    },
    dryRunable: true,
  })
  async updateContentType(
    args: Record<string, unknown>,
    _user: AuthUser,
    ctx: ToolContext,
  ): Promise<unknown> {
    const { name, ...dto } = args;
    if (ctx.dryRun) {
      return {
        action: 'update_content_type',
        name,
        wouldUpdate: await this.contentTypesService.previewUpdate(
          name as string,
          dto as unknown as UpdateContentTypeDto,
        ),
      };
    }
    return this.contentTypesService.update(name as string, dto as unknown as UpdateContentTypeDto);
  }

  @McpTool({
    name: 'add_content_type_field',
    description: 'Add a field to an existing content type',
    role: 'admin',
    inputSchema: {
      type: 'object',
      properties: {
        typeName: { type: 'string' },
        name: { type: 'string' },
        displayName: { type: 'string' },
        type: { type: 'string', enum: [...CONTENT_FIELD_TYPES] },
        isRequired: { type: 'boolean' },
        isLocalized: { type: 'boolean' },
        isUnique: { type: 'boolean' },
        isHidden: { type: 'boolean' },
        position: { type: 'integer', minimum: 0 },
        // Carries the per-field validation rules the content write gate enforces
        // (minLength, regex, choices, allowedMimeTypes, ...).
        config: { type: 'object' },
        defaultValue: {},
        dryRun: { type: 'boolean' },
      },
      required: ['typeName', 'name', 'displayName', 'type'],
    },
    dryRunable: true,
  })
  async addContentTypeField(
    args: Record<string, unknown>,
    _user: AuthUser,
    ctx: ToolContext,
  ): Promise<unknown> {
    const { typeName, ...dto } = args;
    if (ctx.dryRun) {
      return {
        action: 'add_content_type_field',
        ...(await this.contentTypesService.previewCreateField(
          typeName as string,
          dto as unknown as CreateFieldDto,
        )),
      };
    }
    return this.contentTypesService.createField(
      typeName as string,
      dto as unknown as CreateFieldDto,
    );
  }
}
