import { BadRequestException, type CallHandler, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import type { AuditService, LogActionParams } from '../../modules/audit/audit.service';
import { AUDIT_ACTION_KEY } from '../decorators/audit-action.decorator';
import type { AuthUser } from '../types/auth.types';
import { AuditInterceptor } from './audit.interceptor';

interface FakeReq {
  method: string;
  path: string;
  route?: { path?: string };
  params?: Record<string, string>;
  body?: unknown;
  ip?: string;
  headers: Record<string, string>;
  user?: AuthUser;
}

function makeContext(req: FakeReq): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: <T>() => req as unknown as T }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function makeHandler(result: unknown, fail = false): CallHandler {
  return {
    handle: () => (fail ? throwError(() => new BadRequestException('bad')) : of(result)),
  };
}

describe('AuditInterceptor', () => {
  let auditService: { logAction: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let interceptor: AuditInterceptor;

  beforeEach(() => {
    auditService = { logAction: jest.fn() };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    interceptor = new AuditInterceptor(
      auditService as unknown as AuditService,
      reflector as unknown as Reflector,
    );
  });

  function lastLog(): LogActionParams {
    return auditService.logAction.mock.calls[0]?.[0] as LogActionParams;
  }

  it('does not log non-mutating GET requests', async () => {
    const ctx = makeContext({ method: 'GET', path: '/api/v1/users', headers: {} });
    await lastValueFrom(interceptor.intercept(ctx, makeHandler({ data: [] })));
    expect(auditService.logAction).not.toHaveBeenCalled();
  });

  it('logs a successful POST as a create with derived resource + id', async () => {
    const ctx = makeContext({
      method: 'POST',
      path: '/api/v1/users',
      route: { path: '/api/v1/users' },
      body: { email: 'x@kast.local' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest' },
      user: { id: 'admin', email: 'a@kast.local', roles: ['admin'] },
    });
    await lastValueFrom(interceptor.intercept(ctx, makeHandler({ data: { id: 'new-user' } })));

    const log = lastLog();
    expect(log.action).toBe('user.create');
    expect(log.resource).toBe('users');
    expect(log.resourceId).toBe('new-user');
    expect(log.userId).toBe('admin');
    expect(log.ipAddress).toBe('127.0.0.1');
  });

  it('redacts sensitive fields in the captured before/after bodies', async () => {
    const ctx = makeContext({
      method: 'POST',
      path: '/api/v1/auth/reset',
      route: { path: '/api/v1/auth/reset' },
      body: { email: 'x@kast.local', password: 'hunter2', token: 'raw-token' },
      headers: {},
    });
    await lastValueFrom(
      interceptor.intercept(ctx, makeHandler({ data: { id: 'e1', secret: 'shh' } })),
    );

    const log = lastLog();
    const before = log.before as Record<string, unknown>;
    expect(before.email).toBe('x@kast.local');
    expect(before.password).toBe('***REDACTED***');
    expect(before.token).toBe('***REDACTED***');
    const after = log.after as Record<string, unknown>;
    expect(after.secret).toBe('***REDACTED***');
  });

  it('does NOT write an audit log when the handler throws (4xx skips tap)', async () => {
    const ctx = makeContext({
      method: 'POST',
      path: '/api/v1/users',
      route: { path: '/api/v1/users' },
      body: { email: 'x@kast.local' },
      headers: {},
    });
    await expect(
      lastValueFrom(interceptor.intercept(ctx, makeHandler(null, true))),
    ).rejects.toThrow(BadRequestException);
    expect(auditService.logAction).not.toHaveBeenCalled();
  });

  it('omits the after-body for DELETE and uses the path param id', async () => {
    const ctx = makeContext({
      method: 'DELETE',
      path: '/api/v1/users/:id',
      route: { path: '/api/v1/users/:id' },
      params: { id: 'user-to-delete' },
      headers: {},
      user: { id: 'admin', email: 'a@kast.local', roles: ['admin'] },
    });
    await lastValueFrom(interceptor.intercept(ctx, makeHandler(undefined)));

    const log = lastLog();
    expect(log.action).toBe('user.delete');
    expect(log.resourceId).toBe('user-to-delete');
    expect(log.after).toBeUndefined();
  });

  it('honours an @AuditAction override for the action name', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === AUDIT_ACTION_KEY ? 'content.publish' : undefined,
    );
    const ctx = makeContext({
      method: 'POST',
      path: '/api/v1/content-types/blog/entries/e1/publish',
      route: { path: '/api/v1/content-types/:typeSlug/entries/:id/publish' },
      params: { id: 'e1' },
      headers: {},
    });
    await lastValueFrom(interceptor.intercept(ctx, makeHandler({ data: { id: 'e1' } })));
    expect(lastLog().action).toBe('content.publish');
  });

  it('captures the agentTokenId when the request is made by an agent token', async () => {
    const ctx = makeContext({
      method: 'PATCH',
      path: '/api/v1/content-types/blog/entries/:id',
      route: { path: '/api/v1/content-types/:typeSlug/entries/:id' },
      params: { id: 'e1' },
      body: { data: { title: 't' } },
      headers: {},
      user: {
        id: 'svc',
        email: 'svc@kast.local',
        roles: ['editor'],
        isAgentToken: true,
        agentTokenId: 'agent-9',
      },
    });
    await lastValueFrom(interceptor.intercept(ctx, makeHandler({ data: { id: 'e1' } })));
    expect(lastLog().agentTokenId).toBe('agent-9');
  });
});
