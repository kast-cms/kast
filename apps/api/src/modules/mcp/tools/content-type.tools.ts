import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../common/types/auth.types';
import { ContentTypesService } from '../../content-types/content-types.service';
import type {
  CreateContentTypeDto,
  UpdateContentTypeDto,
} from '../../content-types/dto/content-type.dto';
import { McpTool } from '../mcp-tool.decorator';

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
  async listContentTypes(_args: Record<string, unknown>, _user: AuthUser): Promise<unknown> {
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
  async getContentType(args: Record<string, unknown>, _user: AuthUser): Promise<unknown> {
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
      },
      required: ['name', 'displayName'],
    },
    dryRunable: true,
  })
  async createContentType(args: Record<string, unknown>, _user: AuthUser): Promise<unknown> {
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
      },
      required: ['name'],
    },
    dryRunable: true,
  })
  async updateContentType(args: Record<string, unknown>, _user: AuthUser): Promise<unknown> {
    const { name, ...dto } = args;
    return this.contentTypesService.update(name as string, dto as unknown as UpdateContentTypeDto);
  }
}
