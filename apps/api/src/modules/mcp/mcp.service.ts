import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ROLE_HIERARCHY, SYSTEM_ROLES } from '../../common/constants/roles.constants';
import type { AuthUser } from '../../common/types/auth.types';
import { AuditService } from '../audit/audit.service';
import { McpRegistry } from './mcp.registry';
import type {
  McpInitializeResult,
  McpRequest,
  McpResponse,
  McpToolCallParams,
  McpToolListEntry,
} from './types/mcp.types';

const MCP_PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'kast-mcp', version: '1.0.0' };

@Injectable()
export class McpService {
  constructor(
    private readonly registry: McpRegistry,
    private readonly auditService: AuditService,
  ) {}

  async handle(req: McpRequest, user: AuthUser): Promise<McpResponse> {
    switch (req.method) {
      case 'initialize':
        return this.handleInitialize(req.id);
      case 'notifications/initialized':
        return this.okResponse(req.id, {});
      case 'tools/list':
        return this.handleToolsList(req.id);
      case 'tools/call':
        return this.handleToolsCall(req, user);
      default:
        return this.errorResponse(req.id, -32601, `Method not found: ${req.method}`);
    }
  }

  private handleInitialize(id: McpRequest['id']): McpResponse {
    const result: McpInitializeResult = {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    };
    return this.okResponse(id, result);
  }

  private handleToolsList(id: McpRequest['id']): McpResponse {
    const tools: McpToolListEntry[] = this.registry.listTools().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
    return this.okResponse(id, { tools });
  }

  private async handleToolsCall(req: McpRequest, user: AuthUser): Promise<McpResponse> {
    const params = req.params as McpToolCallParams | undefined;
    if (!params?.name) return this.errorResponse(req.id, -32602, 'Missing tool name');

    const tool = this.registry.getTool(params.name);
    if (!tool) return this.errorResponse(req.id, -32601, `Unknown tool: ${params.name}`);

    if (!this.hasRole(user, tool.role)) {
      return this.errorResponse(req.id, -32603, 'FORBIDDEN');
    }

    const args = params.arguments ?? {};
    const dryRun = (args['dryRun'] as boolean | undefined) === true;

    try {
      let result: unknown;
      if (dryRun && tool.dryRunable) {
        const preview = await tool.handler(args, user);
        result = { dryRun: true, preview };
      } else {
        result = await tool.handler(args, user);
      }
      this.auditService.logAction({
        action: `mcp.${params.name}`,
        resource: 'mcp_tool',
        userId: user.id,
        changes: args as unknown as Prisma.InputJsonValue,
      });
      return this.okResponse(req.id, {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Tool execution failed';
      return this.errorResponse(req.id, -32603, message);
    }
  }

  private hasRole(user: AuthUser, requiredRole: string): boolean {
    const hierarchy = ROLE_HIERARCHY as Record<string, number | undefined>;
    const userLevel = user.roles.reduce<number>((max, r) => {
      const level = hierarchy[r] ?? 0;
      return Math.max(max, level);
    }, 0);
    const requiredLevel = hierarchy[requiredRole] ?? ROLE_HIERARCHY[SYSTEM_ROLES.VIEWER];
    return userLevel >= requiredLevel;
  }

  private okResponse(id: McpRequest['id'], result: unknown): McpResponse {
    return { jsonrpc: '2.0', id, result };
  }

  private errorResponse(id: McpRequest['id'], code: number, message: string): McpResponse {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }
}
