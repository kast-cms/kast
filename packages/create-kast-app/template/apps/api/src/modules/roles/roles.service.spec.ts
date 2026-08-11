import {
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Permission } from '@prisma/client';
import type { PermissionResolverService } from '../../common/authorization/permission-resolver.service';
import type { AuthUser } from '../../common/types/auth.types';
import type { RolesRepository, RoleWithCounts, RoleWithPermissions } from './roles.repository';
import { RolesService } from './roles.service';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function buildPermission(over: Partial<Permission> = {}): Permission {
  return {
    id: 'p1',
    resource: 'content',
    action: 'read',
    scope: '*',
    description: null,
    createdAt: new Date(),
    ...over,
  } as Permission;
}

function buildRoleWithPermissions(over: Partial<RoleWithPermissions> = {}): RoleWithPermissions {
  return {
    id: 'role1',
    name: 'custom',
    displayName: 'Custom',
    description: null,
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    permissions: [],
    ...over,
  } as RoleWithPermissions;
}

const adminActor: AuthUser = { id: 'a', email: 'a@kast.local', roles: ['admin'] };
const superActor: AuthUser = { id: 's', email: 's@kast.local', roles: ['super_admin'] };

describe('RolesService', () => {
  let repo: Mocked<RolesRepository>;
  let permissions: { invalidate: jest.Mock; invalidateRoles: jest.Mock };
  let service: RolesService;

  beforeEach(() => {
    repo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      countUsers: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findPermissionsForRoleNames: jest.fn(),
      addPermission: jest.fn(),
      removePermission: jest.fn(),
    } as unknown as Mocked<RolesRepository>;
    permissions = { invalidate: jest.fn(), invalidateRoles: jest.fn() };
    service = new RolesService(
      repo as unknown as RolesRepository,
      permissions as unknown as PermissionResolverService,
    );
  });

  describe('create', () => {
    it('rejects a duplicate role name', async () => {
      repo.findByName.mockResolvedValue({ id: 'exists' });
      await expect(service.create({ name: 'admin', displayName: 'Admin' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('creates a new role', async () => {
      repo.findByName.mockResolvedValue(null);
      repo.create.mockResolvedValue({
        id: 'r2',
        name: 'support',
        displayName: 'Support',
        isSystem: false,
      });
      const result = await service.create({ name: 'support', displayName: 'Support' });
      expect(result.data.name).toBe('support');
      expect(result.data.usersCount).toBe(0);
    });
  });

  describe('update', () => {
    it('throws NotFound when the role is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update('x', { displayName: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('refuses to modify a system role', async () => {
      repo.findById.mockResolvedValue(buildRoleWithPermissions({ isSystem: true }));
      await expect(service.update('role1', { displayName: 'Nope' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('updates a non-system role', async () => {
      repo.findById.mockResolvedValue(buildRoleWithPermissions());
      repo.update.mockResolvedValue({
        id: 'role1',
        name: 'custom',
        displayName: 'Renamed',
        isSystem: false,
      });
      repo.countUsers.mockResolvedValue(3);
      const result = await service.update('role1', { displayName: 'Renamed' });
      expect(result.data.displayName).toBe('Renamed');
      expect(result.data.usersCount).toBe(3);
    });
  });

  describe('delete', () => {
    it('refuses to delete a system role', async () => {
      repo.findById.mockResolvedValue(buildRoleWithPermissions({ isSystem: true }));
      await expect(service.delete('role1')).rejects.toThrow(ForbiddenException);
    });

    it('refuses to delete a role with assigned users', async () => {
      repo.findById.mockResolvedValue(buildRoleWithPermissions());
      repo.countUsers.mockResolvedValue(2);
      await expect(service.delete('role1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('deletes an empty non-system role', async () => {
      repo.findById.mockResolvedValue(buildRoleWithPermissions());
      repo.countUsers.mockResolvedValue(0);
      await service.delete('role1');
      expect(repo.delete).toHaveBeenCalledWith('role1');
    });
  });

  describe('assignPermissions (no privilege escalation, BR-USR-005)', () => {
    it('throws NotFound when the role is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.assignPermissions(
          'x',
          { permissions: [{ resource: 'content', action: 'read' }] },
          adminActor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('blocks granting a permission the actor does not hold', async () => {
      repo.findById.mockResolvedValue(buildRoleWithPermissions());
      repo.findPermissionsForRoleNames.mockResolvedValue([
        buildPermission({ resource: 'content', action: 'read', scope: '*' }),
      ]);
      await expect(
        service.assignPermissions(
          'role1',
          { permissions: [{ resource: 'users', action: 'delete' }] },
          adminActor,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.addPermission).not.toHaveBeenCalled();
    });

    it('allows granting a permission covered by a wildcard scope the actor holds', async () => {
      repo.findById
        .mockResolvedValueOnce(buildRoleWithPermissions())
        .mockResolvedValueOnce(buildRoleWithPermissions());
      repo.findPermissionsForRoleNames.mockResolvedValue([
        buildPermission({ resource: 'content', action: 'update', scope: '*' }),
      ]);
      await service.assignPermissions(
        'role1',
        { permissions: [{ resource: 'content', action: 'update', scope: 'own' }] },
        adminActor,
      );
      expect(repo.addPermission).toHaveBeenCalledWith('role1', 'content', 'update', 'own');
    });

    it('invalidates the resolver cache so the grant takes effect immediately', async () => {
      const role = buildRoleWithPermissions();
      repo.findById.mockResolvedValueOnce(role).mockResolvedValueOnce(role);
      repo.findPermissionsForRoleNames.mockResolvedValue([
        buildPermission({ resource: 'content', action: 'update', scope: '*' }),
      ]);

      await service.assignPermissions(
        'role1',
        { permissions: [{ resource: 'content', action: 'update', scope: 'own' }] },
        adminActor,
      );

      expect(permissions.invalidateRoles).toHaveBeenCalledWith([role.name]);
    });

    it('does not invalidate the cache when the grant is refused', async () => {
      repo.findById.mockResolvedValue(buildRoleWithPermissions());
      repo.findPermissionsForRoleNames.mockResolvedValue([
        buildPermission({ resource: 'content', action: 'read', scope: '*' }),
      ]);

      await expect(
        service.assignPermissions(
          'role1',
          { permissions: [{ resource: 'users', action: 'delete' }] },
          adminActor,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(permissions.invalidateRoles).not.toHaveBeenCalled();
    });

    it('lets a SUPER_ADMIN grant anything without holding it', async () => {
      repo.findById
        .mockResolvedValueOnce(buildRoleWithPermissions())
        .mockResolvedValueOnce(buildRoleWithPermissions());
      await service.assignPermissions(
        'role1',
        { permissions: [{ resource: 'system', action: 'admin' }] },
        superActor,
      );
      expect(repo.findPermissionsForRoleNames).not.toHaveBeenCalled();
      expect(repo.addPermission).toHaveBeenCalledWith('role1', 'system', 'admin', '*');
    });
  });

  describe('removePermission', () => {
    it('throws NotFound when the role is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.removePermission('x', 'p1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFound when the permission is not assigned', async () => {
      repo.findById.mockResolvedValue(buildRoleWithPermissions());
      repo.removePermission.mockResolvedValue(false);
      await expect(service.removePermission('role1', 'p9')).rejects.toThrow(NotFoundException);
    });

    it('removes an assigned permission', async () => {
      repo.findById.mockResolvedValue(buildRoleWithPermissions());
      repo.removePermission.mockResolvedValue(true);
      await service.removePermission('role1', 'p1');
      expect(repo.removePermission).toHaveBeenCalledWith('role1', 'p1');
    });
  });

  describe('findAll / findOne', () => {
    it('lists roles', async () => {
      const row: RoleWithCounts = {
        id: 'r1',
        name: 'admin',
        displayName: 'Admin',
        description: null,
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { users: 1, permissions: 5 },
      } as RoleWithCounts;
      repo.findAll.mockResolvedValue([row]);
      const result = await service.findAll();
      expect(result.data[0]?.permissionsCount).toBe(5);
      expect(result.meta.total).toBe(1);
    });

    it('throws NotFound for a missing role detail', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toThrow(NotFoundException);
    });
  });
});
