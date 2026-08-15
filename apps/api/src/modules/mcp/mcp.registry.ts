import { Injectable, OnModuleInit } from '@nestjs/common';
import { MCP_TOOL_KEY } from './mcp-tool.decorator';
import { McpContentEntryTools } from './tools/content-entry.tools';
import { McpContentTypeTools } from './tools/content-type.tools';
import { McpMediaSeoAuditTools } from './tools/media-seo-audit.tools';
import { McpPlatformTools } from './tools/platform.tools';
import type { McpToolDef, McpToolMeta, ToolHandler } from './types/mcp.types';

type AnyProvider = object;

@Injectable()
export class McpRegistry implements OnModuleInit {
  private readonly tools = new Map<string, McpToolDef>();

  constructor(
    private readonly contentTypeTools: McpContentTypeTools,
    private readonly contentEntryTools: McpContentEntryTools,
    private readonly mediaSeoAuditTools: McpMediaSeoAuditTools,
    private readonly platformTools: McpPlatformTools,
  ) {}

  onModuleInit(): void {
    this.registerProvider(this.contentTypeTools);
    this.registerProvider(this.contentEntryTools);
    this.registerProvider(this.mediaSeoAuditTools);
    this.registerProvider(this.platformTools);
  }

  private registerProvider(provider: AnyProvider): void {
    const proto = Object.getPrototypeOf(provider) as AnyProvider;
    const methods = Object.getOwnPropertyNames(proto);
    for (const method of methods) {
      const fn = (provider as Record<string, ToolHandler | undefined>)[method];
      if (typeof fn !== 'function') continue;
      // @SetMetadata on a method writes to `descriptor.value` — the function
      // itself. Reading (prototype, methodName) instead looks up a different,
      // always-empty slot, which silently registered no tools at all.
      const meta = Reflect.getMetadata(MCP_TOOL_KEY, fn) as McpToolMeta | undefined;
      if (!meta) continue;
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
