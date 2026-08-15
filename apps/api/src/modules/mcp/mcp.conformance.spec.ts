import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { PermissionResolverService } from '../../common/authorization/permission-resolver.service';
import type { AuthUser } from '../../common/types/auth.types';
import { AgentTokenRepository } from '../agent-tokens/agent-token.repository';
import { AuditService } from '../audit/audit.service';
import { McpController } from './mcp.controller';
import { McpRegistry } from './mcp.registry';
import { McpService } from './mcp.service';
import type { McpToolDef } from './types/mcp.types';

const user: AuthUser = {
  id: 'u1',
  email: 'agent@kast.local',
  roles: ['super_admin'],
  isAgentToken: true,
  agentTokenId: 'at1',
  agentTokenName: 'conformance-agent',
  agentTokenScopes: ['list_media'],
};

describe('MCP Streamable HTTP conformance', () => {
  let app: INestApplication;
  let endpoint: URL;
  const handler = jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } });
  const tool: McpToolDef = {
    name: 'list_media',
    description: 'List media',
    role: 'viewer',
    dryRunable: false,
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } },
    },
    handler,
  };

  beforeAll(async () => {
    const registry = {
      listTools: jest.fn().mockReturnValue([tool]),
      getTool: jest.fn((name: string) => (name === tool.name ? tool : undefined)),
    } as unknown as McpRegistry;
    const audit = { logAction: jest.fn() } as unknown as AuditService;
    const agentTokens = { logToolCall: jest.fn() } as unknown as AgentTokenRepository;
    const permissions = {
      isAllowed: jest.fn().mockResolvedValue(false),
    } as unknown as PermissionResolverService;
    const moduleRef = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        McpService,
        { provide: McpRegistry, useValue: registry },
        { provide: AuditService, useValue: audit },
        { provide: AgentTokenRepository, useValue: agentTokens },
        { provide: PermissionResolverService, useValue: permissions },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: Request & { user?: AuthUser }, _res: Response, next: NextFunction) => {
      req.user = user;
      next();
    });
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.listen(0, '127.0.0.1');
    endpoint = new URL('/api/v1/mcp', await app.getUrl());
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['legacy', undefined],
    ['modern negotiation', { mode: 'auto' as const }],
  ])(
    'connects with the official SDK using %s and validates tool inputs',
    async (_label, versionNegotiation) => {
      const client = new Client(
        { name: 'kast-conformance-test', version: '1.0.0' },
        { ...(versionNegotiation ? { versionNegotiation } : {}) },
      );
      const transport = new StreamableHTTPClientTransport(endpoint, {
        requestInit: { headers: { Authorization: 'Bearer kastagent_test' } },
      });

      await client.connect(transport);
      const listed = await client.listTools();
      expect(listed.tools.map((entry) => entry.name)).toEqual(['list_media']);

      const result = await client.callTool({ name: 'list_media', arguments: { limit: 20 } });
      expect(result.isError).not.toBe(true);
      expect(handler).toHaveBeenCalledWith({ limit: 20 }, user, { dryRun: false });

      await expect(
        client.callTool({ name: 'list_media', arguments: { limit: 1_000_000 } }),
      ).rejects.toMatchObject({ code: -32602, message: 'INVALID_PARAMS' });
      await client.close();
    },
  );
});
