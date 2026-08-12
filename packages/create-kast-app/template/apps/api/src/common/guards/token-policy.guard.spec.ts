import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Put,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenScope } from '@prisma/client';
import { Public } from '../decorators/public.decorator';
import type { AuthUser } from '../types/auth.types';
import { TokenPolicyGuard, scopeDataAllows } from './token-policy.guard';

@Controller({ path: 'content-types/:typeSlug/entries', version: '1' })
class EntriesController {
  @Get()
  list(): void {}

  @Post()
  create(): void {}

  @Patch(':id')
  update(): void {}

  @Put(':id')
  replace(): void {}

  @Delete(':id')
  remove(): void {}

  @Post(':id/publish')
  publish(): void {}

  @Post(':id/unarchive')
  unarchive(): void {}

  @Post(':id/restore')
  restore(): void {}

  @Post('bulk/trash')
  bulkTrash(): void {}

  @Post('bulk/publish')
  bulkPublish(): void {}

  @Post('bulk/unpublish')
  bulkUnpublish(): void {}

  // Not a real route: stands in for the next bulk sub-action someone adds
  // without teaching the derivation what permission it needs.
  @Post('bulk/rewrite')
  bulkRewrite(): void {}
}

@Controller({ path: 'settings', version: '1' })
class SettingsController {
  @Get()
  read(): void {}

  @Patch()
  update(): void {}
}

@Controller({ path: 'mcp', version: '1' })
class TestMcpController {
  @Post()
  rpc(): void {}

  @Get('sse')
  sse(): void {}
}

@Controller()
class UnresolvableController {
  @Get()
  root(): void {}
}

@Controller({ path: 'delivery', version: '1' })
class PublicController {
  @Public()
  @Post('content/:type')
  anything(): void {}
}

function makeContext(
  controller: new () => unknown,
  handler: string,
  method: string,
  user?: AuthUser,
  params: Record<string, string> = {},
): ExecutionContext {
  const prototype = controller.prototype as Record<string, unknown>;
  const request = { method, params, path: '/api/v1', user };
  return {
    getClass: () => controller,
    getHandler: () => prototype[handler],
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function apiTokenUser(scope: TokenScope, scopeData?: Record<string, string[]>): AuthUser {
  return {
    id: 'u1',
    email: 'admin@kast.local',
    roles: ['super_admin'],
    isApiToken: true,
    apiTokenId: 't1',
    apiTokenScope: scope,
    ...(scopeData ? { apiTokenScopeData: scopeData } : {}),
  };
}

const agentUser: AuthUser = {
  id: 'u1',
  email: 'admin@kast.local',
  roles: ['super_admin'],
  isAgentToken: true,
  agentTokenId: 'a1',
  agentTokenScopes: [],
};

describe('TokenPolicyGuard', () => {
  let guard: TokenPolicyGuard;

  beforeEach(() => {
    guard = new TokenPolicyGuard(new Reflector());
  });

  describe('non-token principals', () => {
    it('lets an anonymous request through', () => {
      expect(guard.canActivate(makeContext(SettingsController, 'read', 'GET'))).toBe(true);
    });

    it('lets a jwt user mutate', () => {
      const user: AuthUser = { id: 'u1', email: 'a@b.c', roles: ['editor'] };
      expect(guard.canActivate(makeContext(SettingsController, 'update', 'PATCH', user))).toBe(
        true,
      );
    });

    it('rejects a human JWT on the MCP transport', () => {
      const user: AuthUser = { id: 'u1', email: 'a@b.c', roles: ['super_admin'] };
      expect(() => guard.canActivate(makeContext(TestMcpController, 'rpc', 'POST', user))).toThrow(
        ForbiddenException,
      );
    });

    it('short-circuits on a public route even for an agent token', () => {
      expect(guard.canActivate(makeContext(PublicController, 'anything', 'POST', agentUser))).toBe(
        true,
      );
    });
  });

  describe('agent tokens (P0-03)', () => {
    it('allows the mcp rpc transport', () => {
      expect(guard.canActivate(makeContext(TestMcpController, 'rpc', 'POST', agentUser))).toBe(
        true,
      );
    });

    it('allows the mcp sse transport', () => {
      expect(guard.canActivate(makeContext(TestMcpController, 'sse', 'GET', agentUser))).toBe(true);
    });

    it.each([
      ['SettingsController.read', SettingsController, 'read', 'GET'],
      ['SettingsController.update', SettingsController, 'update', 'PATCH'],
      ['EntriesController.list', EntriesController, 'list', 'GET'],
      ['EntriesController.create', EntriesController, 'create', 'POST'],
      ['EntriesController.remove', EntriesController, 'remove', 'DELETE'],
    ])('rejects %s', (_label, controller, handler, method) => {
      expect(() =>
        guard.canActivate(
          makeContext(
            controller as new () => unknown,
            handler as string,
            method as string,
            agentUser,
          ),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('FULL_ACCESS api tokens', () => {
    it.each([
      ['list', 'GET'],
      ['create', 'POST'],
      ['update', 'PATCH'],
      ['remove', 'DELETE'],
    ])('allows %s', (handler, method) => {
      expect(
        guard.canActivate(
          makeContext(EntriesController, handler, method, apiTokenUser(TokenScope.FULL_ACCESS)),
        ),
      ).toBe(true);
    });
  });

  describe('READ_ONLY api tokens (P0-02)', () => {
    it('allows GET', () => {
      expect(
        guard.canActivate(
          makeContext(EntriesController, 'list', 'GET', apiTokenUser(TokenScope.READ_ONLY)),
        ),
      ).toBe(true);
    });

    it('allows HEAD', () => {
      expect(
        guard.canActivate(
          makeContext(EntriesController, 'list', 'HEAD', apiTokenUser(TokenScope.READ_ONLY)),
        ),
      ).toBe(true);
    });

    it.each([
      ['create', 'POST'],
      ['update', 'PATCH'],
      ['replace', 'PUT'],
      ['remove', 'DELETE'],
      ['publish', 'POST'],
    ])('rejects %s (%s)', (handler, method) => {
      expect(() =>
        guard.canActivate(
          makeContext(EntriesController, handler, method, apiTokenUser(TokenScope.READ_ONLY)),
        ),
      ).toThrow(ForbiddenException);
    });

    it('rejects the mcp rpc transport, which is a POST', () => {
      expect(() =>
        guard.canActivate(
          makeContext(TestMcpController, 'rpc', 'POST', apiTokenUser(TokenScope.READ_ONLY)),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('SCOPED api tokens (P0-02)', () => {
    const contentReader = apiTokenUser(TokenScope.SCOPED, { content: ['read'] });

    it('allows the granted resource and action', () => {
      expect(guard.canActivate(makeContext(EntriesController, 'list', 'GET', contentReader))).toBe(
        true,
      );
    });

    it.each([
      ['a content mutation', EntriesController, 'create', 'POST'],
      ['a content sub-action', EntriesController, 'publish', 'POST'],
      ['another resource', SettingsController, 'read', 'GET'],
      ['the mcp transport', TestMcpController, 'rpc', 'POST'],
    ])('rejects %s', (_label, controller, handler, method) => {
      expect(() =>
        guard.canActivate(
          makeContext(
            controller as new () => unknown,
            handler as string,
            method as string,
            contentReader,
          ),
        ),
      ).toThrow(ForbiddenException);
    });

    it('honours a wildcard action list', () => {
      const user = apiTokenUser(TokenScope.SCOPED, { content: ['*'] });
      expect(guard.canActivate(makeContext(EntriesController, 'publish', 'POST', user))).toBe(true);
    });

    it('honours a wildcard resource key', () => {
      const user = apiTokenUser(TokenScope.SCOPED, { '*': ['read'] });
      expect(guard.canActivate(makeContext(SettingsController, 'read', 'GET', user))).toBe(true);
    });

    it('does not let a grant for one content type cross into another', () => {
      const user = apiTokenUser(TokenScope.SCOPED, { 'content:articles': ['read'] });
      expect(
        guard.canActivate(
          makeContext(EntriesController, 'list', 'GET', user, { typeSlug: 'articles' }),
        ),
      ).toBe(true);
      expect(() =>
        guard.canActivate(
          makeContext(EntriesController, 'list', 'GET', user, { typeSlug: 'pages' }),
        ),
      ).toThrow(ForbiddenException);
    });

    it('requires content:* to grant every content type explicitly', () => {
      const broadLegacyKey = apiTokenUser(TokenScope.SCOPED, { content: ['read'] });
      const wildcard = apiTokenUser(TokenScope.SCOPED, { 'content:*': ['read'] });
      expect(() =>
        guard.canActivate(
          makeContext(EntriesController, 'list', 'GET', broadLegacyKey, { typeSlug: 'pages' }),
        ),
      ).toThrow(ForbiddenException);
      expect(
        guard.canActivate(
          makeContext(EntriesController, 'list', 'GET', wildcard, { typeSlug: 'pages' }),
        ),
      ).toBe(true);
    });

    it('rejects when scopeData is missing', () => {
      expect(() =>
        guard.canActivate(
          makeContext(EntriesController, 'list', 'GET', apiTokenUser(TokenScope.SCOPED)),
        ),
      ).toThrow(ForbiddenException);
    });

    it('rejects when the route cannot be resolved', () => {
      expect(() =>
        guard.canActivate(makeContext(UnresolvableController, 'root', 'GET', contentReader)),
      ).toThrow(ForbiddenException);
    });
  });

  // A bulk route is the single-entry route repeated, so it must demand the same
  // grant. Deriving it from the HTTP method let `content: ["create"]` trash.
  describe('bulk routes require what the single-entry route requires', () => {
    const creator = apiTokenUser(TokenScope.SCOPED, { content: ['create'] });
    const deleter = apiTokenUser(TokenScope.SCOPED, { content: ['delete'] });
    const restorer = apiTokenUser(TokenScope.SCOPED, { content: ['restore'] });

    it('refuses bulk trash to a create-only token, exactly as it refuses DELETE :id', () => {
      expect(() =>
        guard.canActivate(makeContext(EntriesController, 'remove', 'DELETE', creator)),
      ).toThrow(ForbiddenException);
      expect(() =>
        guard.canActivate(makeContext(EntriesController, 'bulkTrash', 'POST', creator)),
      ).toThrow(ForbiddenException);
    });

    it('allows bulk trash to a delete-scoped token', () => {
      expect(guard.canActivate(makeContext(EntriesController, 'bulkTrash', 'POST', deleter))).toBe(
        true,
      );
    });

    it.each([
      ['bulkPublish', 'publish'],
      ['bulkUnpublish', 'unpublish'],
    ])('refuses %s to a create-only token', (handler) => {
      expect(() =>
        guard.canActivate(makeContext(EntriesController, handler, 'POST', creator)),
      ).toThrow(ForbiddenException);
    });

    it('holds unarchive to the same grant as its deprecated :id/restore alias', () => {
      expect(() =>
        guard.canActivate(makeContext(EntriesController, 'unarchive', 'POST', creator)),
      ).toThrow(ForbiddenException);
      expect(guard.canActivate(makeContext(EntriesController, 'unarchive', 'POST', restorer))).toBe(
        true,
      );
      expect(guard.canActivate(makeContext(EntriesController, 'restore', 'POST', restorer))).toBe(
        true,
      );
    });

    it('fails closed on a bulk sub-action with no derivable permission', () => {
      const wildcard = apiTokenUser(TokenScope.SCOPED, { content: ['*'] });
      expect(() =>
        guard.canActivate(makeContext(EntriesController, 'bulkRewrite', 'POST', wildcard)),
      ).toThrow(ForbiddenException);
    });
  });

  it('fails closed when the token carries no scope', () => {
    const user: AuthUser = {
      id: 'u1',
      email: 'a@b.c',
      roles: ['super_admin'],
      isApiToken: true,
      apiTokenId: 't1',
    };
    expect(() => guard.canActivate(makeContext(EntriesController, 'list', 'GET', user))).toThrow(
      ForbiddenException,
    );
  });
});

describe('scopeDataAllows', () => {
  const target = { resource: 'content', action: 'read', isMcp: false, resolved: true };

  it('denies an omitted resource', () => {
    expect(scopeDataAllows({ media: ['read'] }, target)).toBe(false);
  });

  it('denies an empty action list', () => {
    expect(scopeDataAllows({ content: [] }, target)).toBe(false);
  });

  it('denies a non-array value', () => {
    expect(
      scopeDataAllows({ content: 'read' } as unknown as Record<string, string[]>, target),
    ).toBe(false);
  });

  it('denies undefined scope data', () => {
    expect(scopeDataAllows(undefined, target)).toBe(false);
  });

  it('allows an exact grant', () => {
    expect(scopeDataAllows({ content: ['read', 'create'] }, target)).toBe(true);
  });

  it('uses an exact scoped-resource grant before resource wildcards', () => {
    const scopedTarget = { ...target, scopeValue: 'articles' };
    expect(scopeDataAllows({ 'content:articles': ['read'] }, scopedTarget)).toBe(true);
    expect(scopeDataAllows({ 'content:pages': ['read'] }, scopedTarget)).toBe(false);
    expect(scopeDataAllows({ 'content:*': ['read'] }, scopedTarget)).toBe(true);
  });
});
