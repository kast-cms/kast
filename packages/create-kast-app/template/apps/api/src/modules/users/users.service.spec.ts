import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth.types';
import { hashResetToken } from '../auth/reset-token.util';
import type { QueueAdapter } from '../queue/queue.adapter';
import { QUEUE_NAMES } from '../queue/queue.constants';
import type { UserRow, UsersRepository } from './users.repository';
import { UsersService } from './users.service';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function buildRow(roleNames: string[], overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'target',
    email: 'target@kast.local',
    firstName: 'T',
    lastName: 'User',
    avatarUrl: null,
    isActive: true,
    isVerified: false,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    roles: roleNames.map((name) => ({ role: { name } })),
    ...overrides,
  } as UserRow;
}

const adminActor: AuthUser = { id: 'admin-id', email: 'admin2@kast.local', roles: ['admin'] };
const superActor: AuthUser = { id: 'super-id', email: 'super@kast.local', roles: ['super_admin'] };

describe('UsersService', () => {
  let repo: Mocked<UsersRepository>;
  let queue: Mocked<QueueAdapter>;
  let service: UsersService;

  beforeEach(() => {
    repo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findRolesByNames: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      hasPassword: jest.fn().mockResolvedValue(false),
      upsertInviteToken: jest.fn().mockResolvedValue(undefined),
      deleteInviteToken: jest.fn().mockResolvedValue(true),
    } as unknown as Mocked<UsersRepository>;
    queue = { enqueue: jest.fn().mockResolvedValue(undefined) } as unknown as Mocked<QueueAdapter>;
    service = new UsersService(
      repo as unknown as UsersRepository,
      queue as unknown as QueueAdapter,
    );
  });

  describe('findAll', () => {
    it('paginates and signals hasNextPage when the repo returns limit+1 rows', async () => {
      const rows = [buildRow(['editor'], { id: 'a' }), buildRow(['editor'], { id: 'b' })];
      repo.findAll.mockResolvedValue({ items: rows, total: 5 });

      const result = await service.findAll({ limit: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.hasNextPage).toBe(true);
      expect(result.meta.cursor).toBe('a');
      expect(result.meta.total).toBe(5);
    });
  });

  describe('findOne', () => {
    it('throws NotFound when the user is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('invite', () => {
    it('rejects inviting your own email', async () => {
      await expect(
        service.invite({ email: 'ADMIN2@kast.local', roleNames: ['viewer'] }, adminActor),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects a duplicate email', async () => {
      repo.findByEmail.mockResolvedValue({ id: 'existing' });
      await expect(
        service.invite({ email: 'dupe@kast.local', roleNames: ['viewer'] }, adminActor),
      ).rejects.toThrow(ConflictException);
    });

    it('blocks an ADMIN from granting a role at or above their own (no escalation)', async () => {
      repo.findByEmail.mockResolvedValue(null);
      await expect(
        service.invite({ email: 'new@kast.local', roleNames: ['admin'] }, adminActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects unknown role names', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.findRolesByNames.mockResolvedValue([{ id: 'r1', name: 'editor', isSystem: true }]);
      await expect(
        service.invite({ email: 'new@kast.local', roleNames: ['editor', 'ghost'] }, adminActor),
      ).rejects.toThrow(/Unknown role/);
    });

    it('creates the user and enqueues an invite email by default', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.findRolesByNames.mockResolvedValue([{ id: 'r1', name: 'editor', isSystem: true }]);
      repo.create.mockResolvedValue(buildRow(['editor'], { email: 'new@kast.local' }));

      const result = await service.invite(
        { email: 'new@kast.local', roleNames: ['editor'] },
        adminActor,
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@kast.local', roleIds: ['r1'] }),
      );
      expect(queue.enqueue).toHaveBeenCalledWith(
        QUEUE_NAMES.EMAIL,
        'user-invite',
        expect.anything(),
      );
      expect(result.data.roles).toEqual(['editor']);
    });

    it('skips the invite email when sendInvite is false', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.findRolesByNames.mockResolvedValue([{ id: 'r1', name: 'editor', isSystem: true }]);
      repo.create.mockResolvedValue(buildRow(['editor']));
      await service.invite(
        { email: 'new@kast.local', roleNames: ['editor'], sendInvite: false },
        adminActor,
      );
      expect(queue.enqueue).not.toHaveBeenCalled();
      expect(repo.upsertInviteToken).not.toHaveBeenCalled();
    });

    it('stores a hashed invite token and mails the raw one', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.findRolesByNames.mockResolvedValue([{ id: 'r1', name: 'editor', isSystem: true }]);
      repo.create.mockResolvedValue(buildRow(['editor'], { id: 'invited' }));

      await service.invite({ email: 'new@kast.local', roleNames: ['editor'] }, adminActor);

      const [userId, hash, expiresAt] = repo.upsertInviteToken.mock.calls[0] as [
        string,
        string,
        Date,
      ];
      const mailed = queue.enqueue.mock.calls[0]?.[2] as { token: string };

      expect(userId).toBe('invited');
      expect(mailed.token).toEqual(expect.any(String));
      expect(hash).not.toBe(mailed.token);
      expect(hash).toBe(hashResetToken(mailed.token));
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('never mails an invitation without a token to redeem', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.findRolesByNames.mockResolvedValue([{ id: 'r1', name: 'editor', isSystem: true }]);
      repo.create.mockResolvedValue(buildRow(['editor']));

      await service.invite({ email: 'new@kast.local', roleNames: ['editor'] }, adminActor);

      const mailed = queue.enqueue.mock.calls[0]?.[2] as { token?: string };
      expect(mailed.token).toBeTruthy();
    });

    it('allows a SUPER_ADMIN to grant any role', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.findRolesByNames.mockResolvedValue([{ id: 'r1', name: 'admin', isSystem: true }]);
      repo.create.mockResolvedValue(buildRow(['admin']));
      await expect(
        service.invite({ email: 'new@kast.local', roleNames: ['admin'] }, superActor),
      ).resolves.toBeDefined();
    });
  });

  describe('resendInvite', () => {
    it('issues a fresh token that replaces the previous one', async () => {
      repo.findById.mockResolvedValue(buildRow(['editor']));

      await service.resendInvite('target', adminActor);
      await service.resendInvite('target', adminActor);

      const first = repo.upsertInviteToken.mock.calls[0]?.[1] as string;
      const second = repo.upsertInviteToken.mock.calls[1]?.[1] as string;
      expect(second).not.toBe(first);
      expect(queue.enqueue).toHaveBeenCalledTimes(2);
    });

    it('404s for an unknown user', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.resendInvite('ghost', adminActor)).rejects.toThrow(NotFoundException);
    });

    it('refuses once the account already has a password', async () => {
      repo.findById.mockResolvedValue(buildRow(['editor']));
      repo.hasPassword.mockResolvedValue(true);

      await expect(service.resendInvite('target', adminActor)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(repo.upsertInviteToken).not.toHaveBeenCalled();
      expect(queue.enqueue).not.toHaveBeenCalled();
    });

    it('refuses when the actor cannot manage the target', async () => {
      repo.findById.mockResolvedValue(buildRow(['super_admin']));
      await expect(service.resendInvite('target', adminActor)).rejects.toThrow(ForbiddenException);
      expect(repo.upsertInviteToken).not.toHaveBeenCalled();
    });
  });

  describe('revokeInvite', () => {
    it('drops the pending token', async () => {
      repo.findById.mockResolvedValue(buildRow(['editor']));
      await service.revokeInvite('target', adminActor);
      expect(repo.deleteInviteToken).toHaveBeenCalledWith('target');
    });

    it('404s for an unknown user', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.revokeInvite('ghost', adminActor)).rejects.toThrow(NotFoundException);
      expect(repo.deleteInviteToken).not.toHaveBeenCalled();
    });

    it('refuses when the actor cannot manage the target', async () => {
      repo.findById.mockResolvedValue(buildRow(['super_admin']));
      await expect(service.revokeInvite('target', adminActor)).rejects.toThrow(ForbiddenException);
      expect(repo.deleteInviteToken).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFound when the target is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.update('x', {}, adminActor)).rejects.toThrow(NotFoundException);
    });

    it('blocks an ADMIN from managing another ADMIN (BR-USR-006)', async () => {
      repo.findById.mockResolvedValue(buildRow(['admin']));
      await expect(service.update('target', { firstName: 'X' }, adminActor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('blocks an ADMIN from promoting an editor up to admin', async () => {
      repo.findById.mockResolvedValue(buildRow(['editor']));
      await expect(service.update('target', { roleNames: ['admin'] }, adminActor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lets an ADMIN update a lower-ranked user', async () => {
      repo.findById.mockResolvedValue(buildRow(['editor']));
      repo.findRolesByNames.mockResolvedValue([{ id: 'rv', name: 'viewer', isSystem: true }]);
      repo.update.mockResolvedValue(buildRow(['viewer']));

      const result = await service.update(
        'target',
        { roleNames: ['viewer'], isActive: false },
        adminActor,
      );

      expect(repo.update).toHaveBeenCalledWith(
        'target',
        expect.objectContaining({ roleIds: ['rv'], isActive: false }),
      );
      expect(result.data.roles).toEqual(['viewer']);
    });

    it('lets a SUPER_ADMIN manage an admin target', async () => {
      repo.findById.mockResolvedValue(buildRow(['admin']));
      repo.update.mockResolvedValue(buildRow(['admin'], { firstName: 'Changed' }));
      await expect(
        service.update('target', { firstName: 'Changed' }, superActor),
      ).resolves.toBeDefined();
    });
  });

  describe('trash', () => {
    it('throws NotFound when the target is missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.trash('x', adminActor)).rejects.toThrow(NotFoundException);
    });

    it('refuses to trash a SUPER_ADMIN account', async () => {
      repo.findById.mockResolvedValue(buildRow(['super_admin']));
      await expect(service.trash('target', superActor)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('refuses to let a user trash their own account', async () => {
      repo.findById.mockResolvedValue(buildRow(['editor'], { id: 'super-id' }));
      await expect(service.trash('super-id', superActor)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('blocks an ADMIN from trashing an equal-ranked admin', async () => {
      repo.findById.mockResolvedValue(buildRow(['admin']));
      await expect(service.trash('target', adminActor)).rejects.toThrow(ForbiddenException);
    });

    it('soft-deletes a lower-ranked user', async () => {
      const trashedAt = new Date('2026-02-02T00:00:00Z');
      repo.findById.mockResolvedValue(buildRow(['editor']));
      repo.softDelete.mockResolvedValue({ trashedAt });
      const result = await service.trash('target', adminActor);
      expect(repo.softDelete).toHaveBeenCalledWith('target', 'admin-id');
      expect(result.data.trashedAt).toBe(trashedAt.toISOString());
    });
  });
});
