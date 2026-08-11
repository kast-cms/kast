import { Injectable } from '@nestjs/common';
import type { Permission, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type RoleWithCounts = Role & {
  _count: { users: number; permissions: number };
};

export type RoleWithPermissions = Role & {
  permissions: { permission: Permission }[];
};

@Injectable()
export class RolesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<RoleWithCounts[]> {
    return this.prisma.role.findMany({
      include: { _count: { select: { users: true, permissions: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  findById(id: string): Promise<RoleWithPermissions | null> {
    return this.prisma.role.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
  }

  findByName(name: string): Promise<Role | null> {
    return this.prisma.role.findUnique({ where: { name } });
  }

  countUsers(roleId: string): Promise<number> {
    return this.prisma.userRole.count({ where: { roleId } });
  }

  create(data: { name: string; displayName: string; description: string | null }): Promise<Role> {
    return this.prisma.role.create({ data });
  }

  update(id: string, data: { displayName?: string; description?: string }): Promise<Role> {
    return this.prisma.role.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.role.delete({ where: { id } });
  }

  /** Permissions effectively held across a set of role names (for escalation checks). */
  async findPermissionsForRoleNames(roleNames: string[]): Promise<Permission[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role: { name: { in: roleNames } } },
      include: { permission: true },
    });
    return rows.map((r) => r.permission);
  }

  /** Upsert a single permission (resource/action/scope) and link it to the role. */
  async addPermission(
    roleId: string,
    resource: string,
    action: string,
    scope: string,
  ): Promise<void> {
    const permission = await this.prisma.permission.upsert({
      where: { resource_action_scope: { resource, action, scope } },
      create: { resource, action, scope },
      update: {},
    });
    await this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: permission.id } },
      create: { roleId, permissionId: permission.id },
      update: {},
    });
  }

  async removePermission(roleId: string, permissionId: string): Promise<boolean> {
    const result = await this.prisma.rolePermission.deleteMany({
      where: { roleId, permissionId },
    });
    return result.count > 0;
  }
}
