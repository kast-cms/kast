import { Injectable, OnModuleInit } from '@nestjs/common';
import { MCP_TOOL_KEY } from './mcp-tool.decorator';
import { McpContentEntryTools } from './tools/content-entry.tools';
import { McpContentTypeTools } from './tools/content-type.tools';
import { McpMediaSeoAuditTools } from './tools/media-seo-audit.tools';
import type { McpToolDef, McpToolMeta, ToolHandler } from './types/mcp.types';

type AnyProvider = object;

@Injectable()
export class McpRegistry implements OnModuleInit {
  private readonly tools = new Map<string, McpToolDef>();

  constructor(
    private readonly contentTypeTools: McpContentTypeTools,
    private readonly contentEntryTools: McpContentEntryTools,
    private readonly mediaSeoAuditTools: McpMediaSeoAuditTools,
  ) {}

  onModuleInit(): void {
    this.registerProvider(this.contentTypeTools);
    this.registerProvider(this.contentEntryTools);
    this.registerProvider(this.mediaSeoAuditTools);
  }

  private registerProvider(provider: AnyProvider): void {
    const proto = Object.getPrototypeOf(provider) as AnyProvider;
    const methods = Object.getOwnPropertyNames(proto);
    for (const method of methods) {
      const meta = Reflect.getMetadata(MCP_TOOL_KEY, proto, method) as McpToolMeta | undefined;
      if (!meta) continue;
      const fn = (provider as Record<string, ToolHandler | undefined>)[method];
      if (!fn) continue;
      const handler = fn.bind(provider) as ToolHandler;
      this.tools.set(meta.name, { ...meta, handler });
    }
  }

  getTool(name: string): McpToolDef | undefined {
    return this.tools.get(name);
  }

  listTools(): McpToolDef[] {
    return Array.from(this.tools.values());
  }
}
