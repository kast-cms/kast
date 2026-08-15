import type { AuthUser } from '../../../common/types/auth.types';

export interface ToolContext {
  /** When true, the tool must compute a preview and perform no writes. */
  dryRun: boolean;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  user: AuthUser,
  ctx: ToolContext,
) => Promise<unknown>;

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
