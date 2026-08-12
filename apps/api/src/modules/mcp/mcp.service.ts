import { toNodeHandler, type NodeMcpRequestHandler } from '@modelcontextprotocol/node';
import {
  createMcpHandler,
  fromJsonSchema,
  McpServer,
  type AuthInfo,
  type CallToolResult,
  type McpRequestContext,
} from '@modelcontextprotocol/server';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/server/validators/ajv';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { PermissionResolverService } from '../../common/authorization/permission-resolver.service';
import { ROLE_HIERARCHY, SYSTEM_ROLES } from '../../common/constants/roles.constants';
import type { AuthUser } from '../../common/types/auth.types';
import { AgentTokenRepository } from '../agent-tokens/agent-token.repository';
import { AuditService } from '../audit/audit.service';
import {
  MCP_INVALID_PARAMS,
  MCP_METHOD_NOT_FOUND,
  MCP_SCOPE_DENIED,
  mcpRpcError,
  parseToolCall,
  safeMcpToolError,
  toMcpAuthInfo,
  userFromMcpAuthInfo,
  type ToolCallRequest,
} from './mcp-rpc.util';
import { isMcpToolName, MCP_TOOL_CATALOG, type McpToolName } from './mcp-tool-catalog';
import { McpRegistry } from './mcp.registry';
import type { McpToolDef } from './types/mcp.types';

const SERVER_INFO = { name: 'kast-mcp', version: '1.0.0' };
type McpNodeRequest = Request & { auth?: AuthInfo };

@Injectable()
export class McpService implements OnModuleDestroy {
  private readonly logger = new Logger(McpService.name);
  private readonly schemaValidator = new AjvJsonSchemaValidator();
  private readonly handler = createMcpHandler((context) => this.createServer(context), {
    legacy: 'stateless',
    responseMode: 'auto',
    keepAliveMs: 15_000,
    onerror: (error) => this.logger.error('MCP protocol error', error),
  });
  private readonly nodeHandler: NodeMcpRequestHandler = toNodeHandler(this.handler, {
    onerror: (error) => this.logger.error('MCP transport error', error),
  });

  constructor(
    private readonly registry: McpRegistry,
    private readonly auditService: AuditService,
    private readonly agentTokenRepo: AgentTokenRepository,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.handler.close();
  }

  async handleHttp(req: Request, res: Response, user: AuthUser): Promise<void> {
    const denied = await this.preflightDeniedCall(req.body, user);
    if (denied) {
      res.status(200).json(denied);
      return;
    }

    const nodeRequest = req as McpNodeRequest;
    nodeRequest.auth = toMcpAuthInfo(user);
    await this.nodeHandler(nodeRequest, res, req.body);
  }

  private async createServer(context: McpRequestContext): Promise<McpServer> {
    const user = userFromMcpAuthInfo(context.authInfo);
    const server = new McpServer(SERVER_INFO, { capabilities: { tools: {} } });
    if (!user) return server;

    for (const tool of this.registry.listTools()) {
      if (!isMcpToolName(tool.name)) continue;
      if (!this.hasAgentScope(user, tool.name)) continue;
      if (!(await this.hasToolPermission(user, tool.name, {}))) continue;
      this.registerTool(server, tool, user);
    }
    return server;
  }

  private registerTool(server: McpServer, tool: McpToolDef, user: AuthUser): void {
    if (!isMcpToolName(tool.name)) return;
    const inputSchema = fromJsonSchema({
      ...tool.inputSchema,
      additionalProperties: false,
    });
    const access = MCP_TOOL_CATALOG[tool.name];
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema,
        annotations: {
          readOnlyHint: access.action === 'read',
          destructiveHint: access.action === 'delete',
          idempotentHint: access.action === 'read' || access.action === 'validate',
        },
      },
      async (args): Promise<CallToolResult> =>
        this.executeTool(tool, user, args as Record<string, unknown>),
    );
  }

  private async executeTool(
    tool: McpToolDef,
    user: AuthUser,
    args: Record<string, unknown>,
  ): Promise<CallToolResult> {
    const started = Date.now();
    const dryRun = args['dryRun'] === true;
    const denial = await this.toolDenialReason(tool, user, args, dryRun);
    if (denial) return this.deniedResult(tool.name, user, args, started, denial);
    return this.invokeTool(tool, user, args, started, dryRun);
  }

  private async invokeTool(
    tool: McpToolDef,
    user: AuthUser,
    args: Record<string, unknown>,
    started: number,
    dryRun: boolean,
  ): Promise<CallToolResult> {
    let handlerResult: unknown;
    try {
      handlerResult = await tool.handler(args, user, { dryRun });
    } catch (error: unknown) {
      const message = safeMcpToolError(error, (cause) =>
        this.logger.error('MCP tool execution failed', cause),
      );
      await this.recordAttempt(tool.name, user, args, started, 'failed', dryRun, message);
      return { content: [{ type: 'text', text: message }], isError: true };
    }

    const result = dryRun ? { dryRun: true, preview: handlerResult } : handlerResult;
    await this.recordAttempt(tool.name, user, args, started, 'success', dryRun);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      ...(result && typeof result === 'object' && !Array.isArray(result)
        ? { structuredContent: result as Record<string, unknown> }
        : {}),
    };
  }

  private async toolDenialReason(
    tool: McpToolDef,
    user: AuthUser,
    args: Record<string, unknown>,
    dryRun: boolean,
  ): Promise<string | undefined> {
    if (!isMcpToolName(tool.name) || !this.hasAgentScope(user, tool.name)) return 'SCOPE_DENIED';
    if (!(await this.hasToolPermission(user, tool.name, args))) return 'RBAC_DENIED';
    return dryRun && !tool.dryRunable ? 'DRY_RUN_NOT_SUPPORTED' : undefined;
  }

  private async deniedResult(
    toolName: string,
    user: AuthUser,
    args: Record<string, unknown>,
    started: number,
    reason: string,
  ): Promise<CallToolResult> {
    await this.recordAttempt(
      toolName,
      user,
      args,
      started,
      'denied',
      args['dryRun'] === true,
      reason,
    );
    return { content: [{ type: 'text', text: reason }], isError: true };
  }

  private async preflightDeniedCall(
    body: unknown,
    user: AuthUser,
  ): Promise<Record<string, unknown> | undefined> {
    const call = parseToolCall(body);
    if (!call) return undefined;
    if (!isMcpToolName(call.name) || !this.registry.getTool(call.name)) {
      return this.unknownToolError(call, user);
    }
    if (!this.hasAgentScope(user, call.name)) return this.accessError(call, user, 'SCOPE_DENIED');
    if (!(await this.hasToolPermission(user, call.name, call.args))) {
      return this.accessError(call, user, 'RBAC_DENIED');
    }
    return this.validationError(call, call.name, user);
  }

  private async unknownToolError(
    call: ToolCallRequest,
    user: AuthUser,
  ): Promise<Record<string, unknown>> {
    await this.recordAttempt(
      call.name,
      user,
      call.args,
      Date.now(),
      'failed',
      false,
      'UNKNOWN_TOOL',
    );
    return mcpRpcError(call, MCP_METHOD_NOT_FOUND, 'UNKNOWN_TOOL');
  }

  private async accessError(
    call: ToolCallRequest,
    user: AuthUser,
    reason: 'SCOPE_DENIED' | 'RBAC_DENIED',
  ): Promise<Record<string, unknown>> {
    await this.recordAttempt(call.name, user, call.args, Date.now(), 'denied', false, reason);
    return mcpRpcError(call, MCP_SCOPE_DENIED, reason);
  }

  private async validationError(
    call: ToolCallRequest,
    toolName: McpToolName,
    user: AuthUser,
  ): Promise<Record<string, unknown> | undefined> {
    const tool = this.registry.getTool(toolName);
    const validation = this.schemaValidator.getValidator<Record<string, unknown>>({
      ...(tool?.inputSchema ?? { type: 'object' }),
      additionalProperties: false,
    })(call.args);
    if (validation.valid) return undefined;
    await this.recordAttempt(
      call.name,
      user,
      call.args,
      Date.now(),
      'failed',
      false,
      'INVALID_PARAMS',
    );
    return mcpRpcError(call, MCP_INVALID_PARAMS, 'INVALID_PARAMS', {
      detail: validation.errorMessage,
    });
  }

  private hasAgentScope(user: AuthUser, toolName: McpToolName): boolean {
    return user.isAgentToken === true && (user.agentTokenScopes ?? []).includes(toolName);
  }

  private async hasToolPermission(
    user: AuthUser,
    toolName: McpToolName,
    args: Record<string, unknown>,
  ): Promise<boolean> {
    const tool = this.registry.getTool(toolName);
    if (!tool) return false;
    if (this.hasSystemRole(user, tool.role)) return true;
    const access = MCP_TOOL_CATALOG[toolName];
    const typeSlug = args['typeSlug'];
    return this.permissionResolver.isAllowed(user.roles, {
      resource: access.resource,
      action: access.action,
      ...(typeof typeSlug === 'string' ? { scopeValue: typeSlug } : {}),
      isMcp: true,
      resolved: true,
    });
  }

  private hasSystemRole(user: AuthUser, requiredRole: string): boolean {
    const hierarchy = ROLE_HIERARCHY as Record<string, number | undefined>;
    const userLevel = user.roles.reduce((max, role) => Math.max(max, hierarchy[role] ?? 0), 0);
    const requiredLevel = hierarchy[requiredRole] ?? ROLE_HIERARCHY[SYSTEM_ROLES.VIEWER];
    return userLevel >= requiredLevel;
  }

  private async recordAttempt(
    toolName: string,
    user: AuthUser,
    args: Record<string, unknown>,
    started: number,
    outcome: 'success' | 'failed' | 'denied',
    dryRun: boolean,
    errorCode?: string,
  ): Promise<void> {
    const durationMs = Math.max(0, Date.now() - started);
    const resourceId = this.resourceId(args);
    await this.auditService.logAction({
      action: `mcp.${toolName}.${outcome}`,
      resource: 'mcp_tool',
      ...(resourceId ? { resourceId } : {}),
      userId: user.id,
      ...(user.agentTokenId ? { agentTokenId: user.agentTokenId } : {}),
      ...(user.agentTokenName ? { agentName: user.agentTokenName } : {}),
      changes: {
        arguments: args,
        durationMs,
        outcome,
        ...(errorCode ? { errorCode } : {}),
      } as unknown as Prisma.InputJsonValue,
      isDryRun: dryRun,
    });
    if (user.agentTokenId) {
      this.agentTokenRepo.logToolCall(
        user.agentTokenId,
        user.agentTokenName,
        toolName,
        durationMs,
        outcome,
      );
    }
  }

  private resourceId(args: Record<string, unknown>): string | undefined {
    const value = args['entryId'] ?? args['id'] ?? args['name'];
    return typeof value === 'string' ? value : undefined;
  }
}
