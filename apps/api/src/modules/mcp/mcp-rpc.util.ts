import type { AuthInfo } from '@modelcontextprotocol/server';
import { HttpException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth.types';

export const MCP_SCOPE_DENIED = -32003;
export const MCP_INVALID_PARAMS = -32602;
export const MCP_METHOD_NOT_FOUND = -32601;

export interface ToolCallRequest {
  id: unknown;
  name: string;
  args: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function parseToolCall(body: unknown): ToolCallRequest | undefined {
  const request = asRecord(body);
  if (request?.['method'] !== 'tools/call') return undefined;
  const params = asRecord(request['params']);
  if (typeof params?.['name'] !== 'string') return undefined;
  return {
    id: request['id'] ?? null,
    name: params['name'],
    args: asRecord(params['arguments']) ?? {},
  };
}

export function toMcpAuthInfo(user: AuthUser): AuthInfo {
  return {
    token: user.agentTokenId ?? 'agent-token',
    clientId: user.agentTokenId ?? user.id,
    scopes: user.agentTokenScopes ?? [],
    extra: { user },
  };
}

export function userFromMcpAuthInfo(authInfo: AuthInfo | undefined): AuthUser | undefined {
  const user = authInfo?.extra?.['user'];
  return user && typeof user === 'object' ? (user as AuthUser) : undefined;
}

export function mcpRpcError(
  call: ToolCallRequest,
  code: number,
  message: string,
  extraData: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    jsonrpc: '2.0',
    id: call.id,
    error: { code, message, data: { tool: call.name, ...extraData } },
  };
}

export function safeMcpToolError(error: unknown, report: (error: unknown) => void): string {
  if (error instanceof HttpException) {
    const response: unknown = error.getResponse();
    if (typeof response === 'string') return response;
    if (response && typeof response === 'object' && 'message' in response) {
      const message = (response as { message?: unknown }).message;
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) {
        return message.filter((item) => typeof item === 'string').join('; ');
      }
    }
  }
  report(error);
  return 'TOOL_EXECUTION_FAILED';
}
