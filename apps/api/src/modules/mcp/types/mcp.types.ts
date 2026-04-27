import type { AuthUser } from '../../../common/types/auth.types';

export type ToolHandler = (args: Record<string, unknown>, user: AuthUser) => Promise<unknown>;

export interface McpToolMeta {
  name: string;
  description: string;
  role: string;
  inputSchema: Record<string, unknown>;
  dryRunable: boolean;
}

export interface McpToolDef extends McpToolMeta {
  handler: ToolHandler;
}

export interface McpCallToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export interface McpServerCapabilities {
  tools: Record<string, never>;
}

export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: McpServerCapabilities;
  serverInfo: { name: string; version: string };
}

export interface McpRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface McpToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpToolListEntry {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
