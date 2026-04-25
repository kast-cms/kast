import { SetMetadata } from '@nestjs/common';
import type { McpToolMeta } from './types/mcp.types';

export const MCP_TOOL_KEY = 'mcp:tool';

export const McpTool = (meta: McpToolMeta): MethodDecorator => SetMetadata(MCP_TOOL_KEY, meta);
