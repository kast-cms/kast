import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Permission } from '@prisma/client';
import { PermissionResolverService } from '../../common/authorization/permission-resolver.service';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import type { AuthUser, PaginatedResult } from '../../common/types/auth.types';
import type {
  AssignPermissionsDto,
  CreateRoleDto,
  PermissionInputDto,
  PermissionResponse,
  RoleDetailResponse,
  RoleSummaryResponse,
  UpdateRoleDto,
} from './dto/role.dto';
import { RolesRepository, type RoleWithCounts, type RoleWithPermissions } from './roles.repository';

@Injectable()
export class RolesService {
  constructor(
    private readonly repo: RolesRepository,
    private readonly permissions: PermissionResolverService,
  ) {}

  private toSummary(row: RoleWithCounts): RoleSummaryResponse {
    return {
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      isSystem: row.isSystem,
      usersCount: row._count.users,
      permissionsCount: row._count.permissions,
    };
  }

  private toDetail(row: RoleWithPermissions): RoleDetailResponse {
    return {
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      isSystem: row.isSystem,
      permissions: row.permissions.map((p) => this.toPermission(p.permission)),
    };
  }

  private toPermission(p: Permission): PermissionResponse {
    return { id: p.id, resource: p.resource, action: p.action, scope: p.scope };
  }

  async findAll(): Promise<PaginatedResult<RoleSummaryResponse>> {
    const rows = await this.repo.findAll();
    const data = rows.map((r) => this.toSummary(r));
    return {
      data,
      meta: { total: data.length, limit: data.length, cursor: null, hasNextPage: false },
    };
  }

  async findOne(id: string): Promise<{ data: RoleDetailResponse }> {
    const role = await this.repo.findById(id);
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    return { data: this.toDetail(role) };
  }

  async create(dto: CreateRoleDto): Promise<{ data: RoleSummaryResponse }> {
    const existing = await this.repo.findByName(dto.name);
    if (existing) throw new UnprocessableEntityException(`Role "${dto.name}" already exists`);
    const role = await this.repo.create({
      name: dto.name,
      displayName: dto.displayName,
      description: dto.description ?? null,
    });
    return {
      data: {
        id: role.id,
        name: role.name,
        displayName: role.displayName,
        isSystem: role.isSystem,
        usersCount: 0,
        permissionsCount: 0,
      },
    };
  }

  async update(id: string, dto: UpdateRoleDto): Promise<{ data: RoleSummaryResponse }> {
    const role = await this.repo.findById(id);
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be modified');
    }
    const updated = await this.repo.update(id, {
      ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
    });
    const usersCount = await this.repo.countUsers(id);
    return {
      data: {
        id: updated.id,
        name: updated.name,
        displayName: updated.displayName,
        isSystem: updated.isSystem,
        usersCount,
        permissionsCount: role.permissions.length,
      },
    };
  }

  async delete(id: string): Promise<void> {
    const role = await this.repo.findById(id);
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }
    const usersCount = await this.repo.countUsers(id);
    if (usersCount > 0) {
      throw new UnprocessableEntityException(
        `Cannot delete a role with ${usersCount} assigned user(s)`,
      );
    }
    await this.repo.delete(id);
  }

  /**
   * Ensures the actor holds every permission they are trying to grant
   * (BR-USR-005: no privilege escalation). SUPER_ADMIN bypasses this check.
   */
  private async assertActorHoldsPermissions(
    actor: AuthUser,
    requested: PermissionInputDto[],
  ): Promise<void> {
    if (actor.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)) return;
    const held = await this.repo.findPermissionsForRoleNames(actor.roles);
    const heldKeys = new Set(held.map((p) => `${p.resource}:${p.action}:${p.scope}`));
    const heldWildcard = new Set(held.map((p) => `${p.resource}:${p.action}`));
    for (const perm of requested) {
      const scope = perm.scope ?? '*';
      const exact = `${perm.resource}:${perm.action}:${scope}`;
      // Holding the permission with scope "*" covers any narrower scope.
      const wildcard = held.some(
        (p) => p.resource === perm.resource && p.action === perm.action && p.scope === '*',
      );
      if (
        !heldKeys.has(exact) &&
        !wildcard &&
        !heldWildcard.has(`${perm.resource}:${perm.action}`)
      ) {
        throw new ForbiddenException(
          `You cannot grant a permission you do not hold: ${perm.resource}.${perm.action}`,
        );
      }
    }
  }

  async assignPermissions(
    id: string,
    dto: AssignPermissionsDto,
    actor: AuthUser,
  ): Promise<{ data: RoleDetailResponse }> {
    const role = await this.repo.findById(id);
    if (!role) throw new NotFoundException(`Role ${id} not found`);

    await this.assertActorHoldsPermissions(actor, dto.permissions);

    const unique = new Map<string, { resource: string; action: string; scope: string }>();
    for (const perm of dto.permissions) {
      const normalized = { ...perm, scope: perm.scope ?? '*' };
      unique.set(`${normalized.resource}:${normalized.action}:${normalized.scope}`, normalized);
    }
    await this.repo.replacePermissions(id, [...unique.values()]);

    // Grants and revocations must both take effect before this request returns.
    this.permissions.invalidateRoles([role.name]);

    const updated = await this.repo.findById(id);
    if (!updated) throw new NotFoundException(`Role ${id} not found`);
    return { data: this.toDetail(updated) };
  }

  async removePermission(id: string, permissionId: string): Promise<void> {
    const role = await this.repo.findById(id);
    if (!role) throw new NotFoundException(`Role ${id} not found`);
    const removed = await this.repo.removePermission(id, permissionId);
    if (!removed) {
      throw new NotFoundException(`Permission ${permissionId} not assigned to role ${id}`);
    }
    // A revoke must take effect immediately, not after the cache TTL.
    this.permissions.invalidateRoles([role.name]);
  }
}
