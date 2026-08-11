import { Controller, Delete, Get, Patch, Post, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { deriveRouteTarget, routeTargetFromPath } from './route-permission.util';

describe('routeTargetFromPath', () => {
  const cases: Array<[string, string, string, string]> = [
    ['/api/v1/content-types', 'GET', 'content-types', 'read'],
    ['/api/v1/content-types', 'POST', 'content-types', 'create'],
    ['/api/v1/content-types/:name/fields', 'POST', 'content-types', 'create'],
    ['/api/v1/content-types/:name/fields/:fieldName', 'PATCH', 'content-types', 'update'],
    ['/api/v1/content-types/:name/fields/:fieldName', 'DELETE', 'content-types', 'delete'],
    ['/api/v1/content-types/:typeSlug/entries', 'GET', 'content', 'read'],
    ['/api/v1/content-types/:typeSlug/entries', 'POST', 'content', 'create'],
    ['/api/v1/content-types/:typeSlug/entries/:id', 'PATCH', 'content', 'update'],
    ['/api/v1/content-types/:typeSlug/entries/:id', 'DELETE', 'content', 'delete'],
    ['/api/v1/content-types/:typeSlug/entries/:id/publish', 'POST', 'content', 'publish'],
    ['/api/v1/content-types/:typeSlug/entries/:id/unpublish', 'POST', 'content', 'unpublish'],
    ['/api/v1/content-types/:typeSlug/entries/:id/archive', 'POST', 'content', 'archive'],
    ['/api/v1/content-types/:typeSlug/entries/:id/restore', 'POST', 'content', 'restore'],
    ['/api/v1/content-types/:typeSlug/entries/:id/schedule', 'POST', 'content', 'schedule'],
    ['/api/v1/content-types/:typeSlug/entries/:id/schedule', 'DELETE', 'content', 'schedule'],
    ['/api/v1/content-types/:typeSlug/entries/:id/locale', 'POST', 'content', 'locale'],
    ['/api/v1/content-types/:typeSlug/entries/:id/versions', 'GET', 'content', 'read'],
    [
      '/api/v1/content-types/:typeSlug/entries/:id/versions/:versionId/revert',
      'POST',
      'content',
      'revert',
    ],
    ['/api/v1/media', 'GET', 'media', 'read'],
    ['/api/v1/media', 'POST', 'media', 'create'],
    ['/api/v1/media/folders', 'POST', 'media', 'create'],
    ['/api/v1/media/folders/:id', 'DELETE', 'media', 'delete'],
    ['/api/v1/media/upload-url', 'POST', 'media', 'create'],
    ['/api/v1/seo/redirects', 'GET', 'seo', 'read'],
    ['/api/v1/seo/redirects/import', 'POST', 'seo', 'import'],
    ['/api/v1/seo/redirects/export', 'GET', 'seo', 'export'],
    ['/api/v1/seo/validate/:entryId', 'POST', 'seo', 'validate'],
    ['/api/v1/seo/score/:entryId', 'GET', 'seo', 'read'],
    ['/api/v1/seo/sitemap.xml', 'GET', 'seo', 'read'],
    ['/api/v1/users', 'GET', 'users', 'read'],
    ['/api/v1/users/:id/sessions', 'GET', 'users', 'read'],
    ['/api/v1/roles/:id/permissions', 'POST', 'roles', 'create'],
    ['/api/v1/roles/:id/permissions/:permissionId', 'DELETE', 'roles', 'delete'],
    ['/api/v1/tokens', 'POST', 'tokens', 'create'],
    ['/api/v1/tokens/:id', 'DELETE', 'tokens', 'delete'],
    ['/api/v1/agent-tokens', 'GET', 'agent-tokens', 'read'],
    ['/api/v1/agent-tokens/:id', 'DELETE', 'agent-tokens', 'delete'],
    ['/api/v1/webhooks/:id/test', 'POST', 'webhooks', 'test'],
    ['/api/v1/webhooks/:id/deliveries', 'GET', 'webhooks', 'read'],
    ['/api/v1/webhooks/:id/deliveries/:deliveryId/redeliver', 'POST', 'webhooks', 'create'],
    ['/api/v1/plugins/install', 'POST', 'plugins', 'install'],
    ['/api/v1/plugins/:name/enable', 'POST', 'plugins', 'enable'],
    ['/api/v1/plugins/:name/disable', 'POST', 'plugins', 'disable'],
    ['/api/v1/plugins/:name/config', 'PATCH', 'plugins', 'update'],
    ['/api/v1/plugins/:name', 'DELETE', 'plugins', 'delete'],
    ['/api/v1/forms/:id/submissions', 'GET', 'forms', 'read'],
    ['/api/v1/forms/:id/submissions/export', 'GET', 'forms', 'export'],
    ['/api/v1/forms/:id/submit', 'POST', 'forms', 'create'],
    ['/api/v1/menus/:id/items/reorder', 'POST', 'menus', 'create'],
    ['/api/v1/menus/:id/items/:itemId', 'DELETE', 'menus', 'delete'],
    ['/api/v1/trash', 'GET', 'trash', 'read'],
    ['/api/v1/trash/:model/:id/restore', 'POST', 'trash', 'restore'],
    ['/api/v1/trash/:model/:id', 'DELETE', 'trash', 'delete'],
    ['/api/v1/locales/:code/set-default', 'POST', 'locales', 'create'],
    ['/api/v1/settings', 'GET', 'settings', 'read'],
    ['/api/v1/settings', 'PATCH', 'settings', 'update'],
    ['/api/v1/settings/test-smtp', 'POST', 'settings', 'create'],
    ['/api/v1/audit', 'GET', 'audit', 'read'],
    ['/api/v1/audit/export', 'GET', 'audit', 'export'],
    ['/api/v1/dashboard/stats', 'GET', 'dashboard', 'read'],
    ['/api/v1/search', 'GET', 'search', 'read'],
    ['/api/v1/delivery/content/:type/:slug', 'GET', 'delivery', 'read'],
    ['/api/v1/health', 'GET', 'health', 'read'],
    ['/api/v1/robots.txt', 'GET', 'robots.txt', 'read'],
    ['/api/v1/stripe/webhook', 'POST', 'stripe', 'create'],
    ['/api/v1/auth/login', 'POST', 'auth', 'create'],
    ['/api/v1/auth/me', 'GET', 'auth', 'read'],
    ['/api/v1/mcp', 'POST', 'mcp', 'create'],
    ['/api/v1/mcp/sse', 'GET', 'mcp', 'read'],
  ];

  it.each(cases)('maps %s %s to %s:%s', (path, method, resource, action) => {
    const target = routeTargetFromPath(path, method);
    expect(target.resolved).toBe(true);
    expect(target.resource).toBe(resource);
    expect(target.action).toBe(action);
  });

  it('flags only the mcp transport', () => {
    expect(routeTargetFromPath('/api/v1/mcp', 'POST').isMcp).toBe(true);
    expect(routeTargetFromPath('/api/v1/mcp/sse', 'GET').isMcp).toBe(true);
    expect(routeTargetFromPath('/api/v1/settings', 'GET').isMcp).toBe(false);
    expect(routeTargetFromPath('/api/v1/agent-tokens', 'GET').isMcp).toBe(false);
  });

  it('carries the content-type slug as the scope value', () => {
    const target = routeTargetFromPath('/api/v1/content-types/:typeSlug/entries', 'GET', {
      typeSlug: 'blog-post',
    });
    expect(target.scopeValue).toBe('blog-post');
  });

  it('leaves the scope value undefined for routes without a content type', () => {
    expect(routeTargetFromPath('/api/v1/media', 'GET', {}).scopeValue).toBeUndefined();
  });

  it('is unresolved when no meaningful segment remains', () => {
    expect(routeTargetFromPath('/api/v1', 'GET').resolved).toBe(false);
    expect(routeTargetFromPath('/', 'GET').resolved).toBe(false);
    expect(routeTargetFromPath('/:id', 'GET').resolved).toBe(false);
  });

  it('is unresolved for an unmapped HTTP method', () => {
    expect(routeTargetFromPath('/api/v1/media', 'TRACE').resolved).toBe(false);
  });

  it('does not treat a leading action verb as a sub-action', () => {
    const target = routeTargetFromPath('/api/v1/export', 'GET');
    expect(target.resource).toBe('export');
    expect(target.action).toBe('read');
  });
});

describe('deriveRouteTarget', () => {
  const reflector = new Reflector();

  @Controller({ path: 'content-types/:typeSlug/entries', version: '1' })
  class EntriesController {
    @Get()
    list(): void {}

    @Post(':id/publish')
    publish(): void {}

    @Patch(':id')
    update(): void {}

    @Delete(':id')
    remove(): void {}
  }

  @Controller({ path: 'mcp', version: '1' })
  class TestMcpController {
    @Post()
    rpc(): void {}
  }

  function contextFor(target: new () => unknown, handlerName: string): ExecutionContext {
    const prototype = target.prototype as Record<string, unknown>;
    return {
      getClass: () => target,
      getHandler: () => prototype[handlerName],
    } as unknown as ExecutionContext;
  }

  function requestFor(method: string, params: Record<string, string> = {}): Request {
    return { method, params, path: '/unused' } as unknown as Request;
  }

  it('derives resource and action from controller metadata', () => {
    const target = deriveRouteTarget(
      contextFor(EntriesController, 'list'),
      requestFor('GET', { typeSlug: 'blog-post' }),
      reflector,
    );
    expect(target).toMatchObject({
      resource: 'content',
      action: 'read',
      scopeValue: 'blog-post',
      isMcp: false,
      resolved: true,
    });
  });

  it('honours a sub-action segment on the handler', () => {
    const target = deriveRouteTarget(
      contextFor(EntriesController, 'publish'),
      requestFor('POST', { typeSlug: 'blog-post' }),
      reflector,
    );
    expect(target.action).toBe('publish');
  });

  it.each([
    ['update', 'PATCH', 'update'],
    ['remove', 'DELETE', 'delete'],
  ])('maps handler %s to %s', (handler, method, action) => {
    const target = deriveRouteTarget(
      contextFor(EntriesController, handler),
      requestFor(method),
      reflector,
    );
    expect(target.action).toBe(action);
  });

  it('flags the mcp controller', () => {
    const target = deriveRouteTarget(
      contextFor(TestMcpController, 'rpc'),
      requestFor('POST'),
      reflector,
    );
    expect(target).toMatchObject({ resource: 'mcp', action: 'create', isMcp: true });
  });

  it('falls back to the matched express route when metadata is absent', () => {
    const context = {
      getClass: () => undefined,
      getHandler: () => undefined,
    } as unknown as ExecutionContext;
    const req = {
      method: 'DELETE',
      params: {},
      route: { path: '/api/v1/settings' },
      path: '/api/v1/settings',
    } as unknown as Request;
    expect(deriveRouteTarget(context, req, reflector)).toMatchObject({
      resource: 'settings',
      action: 'delete',
      resolved: true,
    });
  });

  it('reports unresolved when nothing yields a resource', () => {
    const context = {
      getClass: () => undefined,
      getHandler: () => undefined,
    } as unknown as ExecutionContext;
    const req = { method: 'GET', params: {}, path: '/api/v1' } as unknown as Request;
    expect(deriveRouteTarget(context, req, reflector).resolved).toBe(false);
  });
});
