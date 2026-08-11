import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { assertCanManageUser, highestRoleRank } from '../../common/authorization/role-rank.util';
import { SYSTEM_ROLES } from '../../common/constants/roles.constants';
import type { AuthUser, PaginatedResult } from '../../common/types/auth.types';
import { generateResetToken } from '../auth/reset-token.util';
import { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type {
  InviteUserDto,
  UpdateUserDto,
  UserListQueryDto,
  UserSummaryResponse,
} from './dto/user.dto';
import { UsersRepository, type UserRow } from './users.repository';

/** An invitation stays redeemable for a week, then has to be re-sent. */
const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly queue: QueueAdapter,
  ) {}

  private toSummary(row: UserRow): UserSummaryResponse {
    return {
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      avatarUrl: row.avatarUrl,
      isActive: row.isActive,
      isVerified: row.isVerified,
      // An invited account has no password until the invite is accepted, so
      // this is what distinguishes "invited" from "active" in the admin. The
      // hash itself is never sent.
      hasPendingInvite: row.passwordHash === null,
      roles: row.roles.map((r) => r.role.name),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Throws if the actor is not a SUPER_ADMIN and the proposed role set contains
   * a role ranked at or above the actor's own — prevents privilege escalation
   * (BR-USR-005 / BR-USR-006).
   */
  private assertNoEscalation(actor: AuthUser, targetRoleNames: string[]): void {
    if (actor.roles.includes(SYSTEM_ROLES.SUPER_ADMIN)) return;
    if (highestRoleRank(targetRoleNames) >= highestRoleRank(actor.roles)) {
      throw new ForbiddenException('Cannot grant a role equal to or above your own');
    }
  }

  /**
   * Throws if the actor is not a SUPER_ADMIN and the target user holds a role
   * ranked at or above the actor's own (BR-USR-006: ADMIN cannot touch ADMIN
   * or SUPER_ADMIN accounts). Shared with the trash routes, which can re-enable
   * an account and so enforce the identical rule — see role-rank.util.ts.
   */
  private assertCanManageTarget(actor: AuthUser, target: UserRow): void {
    assertCanManageUser(
      actor.roles,
      target.roles.map((r) => r.role.name),
    );
  }

  async findAll(query: UserListQueryDto): Promise<PaginatedResult<UserSummaryResponse>> {
    const limit = query.limit ?? 20;
    const { items, total } = await this.repo.findAll(query);
    const hasNextPage = items.length > limit;
    const page = hasNextPage ? items.slice(0, limit) : items;
    const cursor = hasNextPage ? (page[page.length - 1]?.id ?? null) : null;
    return {
      data: page.map((u) => this.toSummary(u)),
      meta: { total, limit, cursor, hasNextPage },
    };
  }

  async findOne(id: string): Promise<{ data: UserSummaryResponse }> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return { data: this.toSummary(user) };
  }

  private async resolveRoleIds(roleNames: string[]): Promise<string[]> {
    const roles = await this.repo.findRolesByNames(roleNames);
    if (roles.length !== new Set(roleNames).size) {
      const found = new Set(roles.map((r) => r.name));
      const missing = roleNames.filter((n) => !found.has(n));
      throw new BadRequestException(`Unknown role(s): ${missing.join(', ')}`);
    }
    return roles.map((r) => r.id);
  }

  async invite(dto: InviteUserDto, actor: AuthUser): Promise<{ data: UserSummaryResponse }> {
    if (dto.email.toLowerCase() === actor.email.toLowerCase()) {
      throw new UnprocessableEntityException('Cannot invite your own email address');
    }
    const existing = await this.repo.findByEmail(dto.email);
    if (existing) throw new ConflictException('A user with this email already exists');

    this.assertNoEscalation(actor, dto.roleNames);
    const roleIds = await this.resolveRoleIds(dto.roleNames);

    const user = await this.repo.create({
      email: dto.email,
      firstName: dto.firstName ?? null,
      lastName: dto.lastName ?? null,
      roleIds,
    });

    if (dto.sendInvite !== false) {
      await this.issueInvite(user);
    }

    return { data: this.toSummary(user) };
  }

  /**
   * Re-sends an invitation, replacing any token already outstanding. Refused
   * once the account has a password: at that point the credential the invite
   * grants is no longer "your first password" but a silent reset of an active
   * account, which is what /auth/forgot-password is for.
   */
  async resendInvite(id: string, actor: AuthUser): Promise<{ data: { id: string } }> {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundException(`User ${id} not found`);
    this.assertCanManageTarget(actor, target);
    if (await this.repo.hasPassword(id)) {
      throw new UnprocessableEntityException(
        'This user has already set a password; use the password reset flow instead',
      );
    }
    await this.issueInvite(target);
    return { data: { id } };
  }

  /** Invalidates the outstanding invitation without touching the account. */
  async revokeInvite(id: string, actor: AuthUser): Promise<{ data: { id: string } }> {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundException(`User ${id} not found`);
    this.assertCanManageTarget(actor, target);
    await this.repo.deleteInviteToken(id);
    return { data: { id } };
  }

  private async issueInvite(user: UserRow): Promise<void> {
    const { raw, hash } = generateResetToken();
    await this.repo.upsertInviteToken(user.id, hash, new Date(Date.now() + INVITE_TOKEN_TTL_MS));
    await this.queue.enqueue(QUEUE_NAMES.EMAIL, 'user-invite', {
      to: user.email,
      firstName: user.firstName,
      token: raw,
    });
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: AuthUser,
  ): Promise<{ data: UserSummaryResponse }> {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundException(`User ${id} not found`);

    this.assertCanManageTarget(actor, target);

    let roleIds: string[] | undefined;
    if (dto.roleNames) {
      this.assertNoEscalation(actor, dto.roleNames);
      roleIds = await this.resolveRoleIds(dto.roleNames);
    }

    const updated = await this.repo.update(id, {
      ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(roleIds ? { roleIds } : {}),
    });
    return { data: this.toSummary(updated) };
  }

  async trash(id: string, actor: AuthUser): Promise<{ data: { id: string; trashedAt: string } }> {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundException(`User ${id} not found`);

    const targetRoles = target.roles.map((r) => r.role.name);
    if (targetRoles.includes(SYSTEM_ROLES.SUPER_ADMIN)) {
      throw new UnprocessableEntityException('Super Admin account cannot be trashed');
    }
    this.assertCanManageTarget(actor, target);
    if (id === actor.id) {
      throw new UnprocessableEntityException('You cannot trash your own account');
    }

    const { trashedAt } = await this.repo.softDelete(id, actor.id);
    return { data: { id, trashedAt: (trashedAt ?? new Date()).toISOString() } };
  }
}
