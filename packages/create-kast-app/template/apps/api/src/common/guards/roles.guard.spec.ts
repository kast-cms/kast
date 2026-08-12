import {
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  permissionMatches,
  type PermissionResolverService,
} from '../authorization/permission-resolver.service';
import { SYSTEM_ROLES } from '../constants/roles.constants';
import { Public } from '../decorators/public.decorator';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { Roles } from '../decorators/roles.decorator';
import type { AuthUser } from '../types/auth.types';
import { RolesGuard } from './roles.guard';

@Controller({ path: 'content-types/:typeSlug/entries', version: '1' })
class EntriesController {
  @Get()
  @Roles(SYSTEM_ROLES.VIEWER, SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  list(): void {}

  @Post()
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  create(): void {}

  @Post(':id/publish')
  @Roles(SYSTEM_ROLES.EDITOR, SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  publish(): void {}
}

@Controller({ path: 'settings', version: '1' })
class SettingsController {
  @Get()
  @Roles(SYSTEM_ROLES.ADMIN, SYSTEM_ROLES.SUPER_ADMIN)
  read(): void {}

  @Patch()
  @Roles(SYSTEM_ROLES.SUPER_ADMIN)
  update(): void {}
}

@Controller({ path: 'tokens', version: '1' })
class UndecoratedController {
  @Post()
  create(): void {}
}

@Controller({ path: 'delivery', version: '1' })
class PublicController {
  @Public()
  @Get('content/:type')
  read(): void {}
}

@Controller({ path: 'media', version: '1' })
class OverriddenController {
  @Get()
  @RequirePermission('seo', 'read')
  read(): void {}
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

function user(roles: string[]): AuthUser {
  return { id: 'u1', email: 'a@b.c', roles };
}

describe('RolesGuard', () => {
  let resolver: { isAllowed: jest.Mock };
  let guard: RolesGuard;

  beforeEach(() => {
    resolver = { isAllowed: jest.fn().mockResolvedValue(false) };
    guard = new RolesGuard(new Reflector(), resolver as unknown as PermissionResolverService);
  });

  describe('existing behaviour is preserved', () => {
    it('allows super_admin everywhere', async () => {
      await expect(
        guard.canActivate(
          makeContext(SettingsController, 'update', 'PATCH', user([SYSTEM_ROLES.SUPER_ADMIN])),
        ),
      ).resolves.toBe(true);
      expect(resolver.isAllowed).not.toHaveBeenCalled();
    });

    it('allows a matching @Roles system role', async () => {
      await expect(
        guard.canActivate(
          makeContext(EntriesController, 'create', 'POST', user([SYSTEM_ROLES.EDITOR])),
        ),
      ).resolves.toBe(true);
      expect(resolver.isAllowed).not.toHaveBeenCalled();
    });

    it('fails closed for a non-super-admin system role on an undecorated route', async () => {
      // An undecorated handler declares nothing, so a role below super_admin
      // only passes if the resolver grants the derived permission.
      await expect(
        guard.canActivate(
          makeContext(UndecoratedController, 'create', 'POST', user([SYSTEM_ROLES.VIEWER])),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(resolver.isAllowed).toHaveBeenCalled();
    });

    it('allows a public route with no principal', async () => {
      await expect(guard.canActivate(makeContext(PublicController, 'read', 'GET'))).resolves.toBe(
        true,
      );
    });

    it('allows an undecorated route with no principal', async () => {
      await expect(
        guard.canActivate(makeContext(UndecoratedController, 'create', 'POST')),
      ).resolves.toBe(true);
    });

    it('rejects a @Roles route with no principal', async () => {
      await expect(
        guard.canActivate(makeContext(SettingsController, 'read', 'GET')),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a system role that does not match and holds no permission', async () => {
      await expect(
        guard.canActivate(
          makeContext(SettingsController, 'update', 'PATCH', user([SYSTEM_ROLES.EDITOR])),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('custom roles (P0-04)', () => {
    it('allows a custom role granted the derived resource:action', async () => {
      resolver.isAllowed.mockResolvedValue(true);
      await expect(
        guard.canActivate(
          makeContext(EntriesController, 'create', 'POST', user(['content-writer']), {
            typeSlug: 'blog-post',
          }),
        ),
      ).resolves.toBe(true);
      expect(resolver.isAllowed).toHaveBeenCalledWith(
        ['content-writer'],
        expect.objectContaining({
          resource: 'content',
          action: 'create',
          scopeValue: 'blog-post',
        }),
      );
    });

    it('derives the sub-action for a publish route', async () => {
      resolver.isAllowed.mockResolvedValue(true);
      await guard.canActivate(
        makeContext(EntriesController, 'publish', 'POST', user(['content-writer'])),
      );
      expect(resolver.isAllowed).toHaveBeenCalledWith(
        ['content-writer'],
        expect.objectContaining({ resource: 'content', action: 'publish' }),
      );
    });

    it('rejects a custom role without the permission', async () => {
      await expect(
        guard.canActivate(makeContext(SettingsController, 'read', 'GET', user(['content-writer']))),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a custom-role-only user on an undecorated route', async () => {
      await expect(
        guard.canActivate(
          makeContext(UndecoratedController, 'create', 'POST', user(['content-writer'])),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(resolver.isAllowed).toHaveBeenCalledWith(
        ['content-writer'],
        expect.objectContaining({ resource: 'tokens', action: 'create' }),
      );
    });

    it('rejects a user with no roles at all', async () => {
      await expect(
        guard.canActivate(makeContext(UndecoratedController, 'create', 'POST', user([]))),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('@RequirePermission override', () => {
    it('replaces the derived resource and action', async () => {
      resolver.isAllowed.mockResolvedValue(true);
      await guard.canActivate(
        makeContext(OverriddenController, 'read', 'GET', user(['seo-reader'])),
      );
      expect(resolver.isAllowed).toHaveBeenCalledWith(
        ['seo-reader'],
        expect.objectContaining({ resource: 'seo', action: 'read', resolved: true }),
      );
    });
  });
});

describe('permissionMatches', () => {
  const target = {
    resource: 'content',
    action: 'publish',
    scopeValue: 'blog-post',
    isMcp: false,
    resolved: true,
  };

  it('matches an exact grant', () => {
    expect(permissionMatches({ resource: 'content', action: 'publish', scope: '*' }, target)).toBe(
      true,
    );
  });

  it('matches a resource wildcard', () => {
    expect(permissionMatches({ resource: '*', action: 'publish', scope: '*' }, target)).toBe(true);
  });

  it('matches an action wildcard', () => {
    expect(permissionMatches({ resource: 'content', action: '*', scope: '*' }, target)).toBe(true);
  });

  it('matches a scope equal to the content type', () => {
    expect(
      permissionMatches({ resource: 'content', action: 'publish', scope: 'blog-post' }, target),
    ).toBe(true);
  });

  it('rejects a scope for another content type', () => {
    expect(
      permissionMatches({ resource: 'content', action: 'publish', scope: 'page' }, target),
    ).toBe(false);
  });

  it('rejects a narrow scope on a route without a scope value', () => {
    expect(
      permissionMatches(
        { resource: 'media', action: 'read', scope: 'blog-post' },
        { resource: 'media', action: 'read', isMcp: false, resolved: true },
      ),
    ).toBe(false);
  });

  it('rejects a different resource', () => {
    expect(permissionMatches({ resource: 'media', action: 'publish', scope: '*' }, target)).toBe(
      false,
    );
  });

  it('rejects a different action', () => {
    expect(permissionMatches({ resource: 'content', action: 'read', scope: '*' }, target)).toBe(
      false,
    );
  });
});
