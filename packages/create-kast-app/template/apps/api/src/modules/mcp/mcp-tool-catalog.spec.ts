import 'reflect-metadata';
import {
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
} from '../../common/authorization/permission-catalog';
import { MCP_TOOL_CATALOG, MCP_TOOL_NAMES } from './mcp-tool-catalog';
import { McpRegistry } from './mcp.registry';
import { McpContentEntryTools } from './tools/content-entry.tools';
import { McpContentTypeTools } from './tools/content-type.tools';
import { McpMediaSeoAuditTools } from './tools/media-seo-audit.tools';
import { McpPlatformTools } from './tools/platform.tools';

/**
 * The catalog is the allow-list an agent token's scopes validate against, and
 * the registry is what `tools/list` advertises and `tools/call` dispatches. A
 * name in one and not the other is either a tool nobody can be scoped for or a
 * scope that grants nothing, and neither fails loudly at runtime.
 */
describe('MCP tool catalog', () => {
  const stub = (): never => undefined as never;

  function buildRegistry(): McpRegistry {
    const registry = new McpRegistry(
      new McpContentTypeTools(stub()),
      new McpContentEntryTools(stub(), stub(), stub()),
      new McpMediaSeoAuditTools(stub(), stub(), stub()),
      new McpPlatformTools(stub(), stub()),
    );
    registry.onModuleInit();
    return registry;
  }

  it('registers exactly the tools the catalog names', () => {
    const registered = buildRegistry()
      .listTools()
      .map((tool) => tool.name)
      .sort();

    expect(registered).toEqual([...MCP_TOOL_NAMES].sort());
  });

  it('maps every tool onto a resource and action the RBAC catalog knows', () => {
    for (const [tool, target] of Object.entries(MCP_TOOL_CATALOG)) {
      expect(PERMISSION_RESOURCES).toContain(target.resource);
      expect(PERMISSION_ACTIONS).toContain(target.action);
      expect(tool).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('declares an object input schema for every tool', () => {
    for (const tool of buildRegistry().listTools()) {
      expect(tool.inputSchema['type']).toBe('object');
    }
  });

  it('accepts a dryRun argument on exactly the tools that advertise dry run', () => {
    for (const tool of buildRegistry().listTools()) {
      const properties = (tool.inputSchema['properties'] ?? {}) as Record<string, unknown>;
      expect(Object.hasOwn(properties, 'dryRun')).toBe(tool.dryRunable);
    }
  });
});
