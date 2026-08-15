import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../common/types/auth.types';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { MediaService } from '../media/media.service';
import { TRASH_MODELS, type TrashModel } from './dto/trash-query.dto';
import { decodeTrashCursor, encodeTrashCursor } from './trash-cursor.util';
import { TRASH_RETENTION_MS } from './trash.constants';
import { TrashService } from './trash.service';

interface Delegate {
  findMany: jest.Mock;
  count: jest.Mock;
  findFirst: jest.Mock;
  findUniqueOrThrow: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
}

function delegate(): Delegate {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findFirst: jest.fn().mockResolvedValue({ id: 'x', roles: [] }),
    findUniqueOrThrow: jest.fn().mockResolvedValue({ preTrashIsActive: true }),
    update: jest.fn().mockResolvedValue({}),
    delete: jest.fn().mockResolvedValue({}),
  };
}

const T = (iso: string): Date => new Date(iso);

const actor = (id: string, ...roles: string[]): AuthUser => ({
  id,
  email: `${id}@kast.local`,
  roles,
});

const SUPER_ADMIN = actor('root1', 'super_admin');
const ADMIN = actor('admin1', 'admin');
/** A custom role carrying only `trash:restore`, which RolesGuard also lets through. */
const CUSTOM = actor('bot1', 'recovery-bot');

const withRoles = (...names: string[]): { id: string; roles: { role: { name: string } }[] } => ({
  id: 'u1',
  roles: names.map((name) => ({ role: { name } })),
});

describe('TrashService', () => {
  let prisma: {
    contentEntry: Delegate;
    mediaFile: Delegate;
    user: Delegate;
    form: Delegate;
  };
  let audit: { logAction: jest.Mock };
  let media: { purge: jest.Mock };
  let service: TrashService;

  const delegateFor = (model: TrashModel): Delegate =>
    model === 'content'
      ? prisma.contentEntry
      : model === 'media'
        ? prisma.mediaFile
        : model === 'user'
          ? prisma.user
          : prisma.form;

  beforeEach(() => {
    prisma = {
      contentEntry: delegate(),
      mediaFile: delegate(),
      user: delegate(),
      form: delegate(),
    };
    audit = { logAction: jest.fn() };
    media = { purge: jest.fn().mockResolvedValue(undefined) };
    service = new TrashService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      media as unknown as MediaService,
    );
  });

  describe('list', () => {
    it('orders the page across models instead of letting one model fill it', async () => {
      prisma.contentEntry.findMany.mockResolvedValue([
        { id: 'c1', trashedAt: T('2026-03-01T00:00:00.000Z'), trashedByUserId: null, locales: [] },
        { id: 'c2', trashedAt: T('2026-02-01T00:00:00.000Z'), trashedByUserId: null, locales: [] },
        { id: 'c3', trashedAt: T('2026-01-01T00:00:00.000Z'), trashedByUserId: null, locales: [] },
      ]);
      prisma.contentEntry.count.mockResolvedValue(3);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'u1',
          email: 'gone@kast.local',
          trashedAt: T('2026-04-01T00:00:00.000Z'),
          trashedByUserId: 'admin1',
        },
      ]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.list({ limit: 2 });

      expect(result.items.map((i) => `${i.model}:${i.id}`)).toEqual(['user:u1', 'content:c1']);
      expect(result.total).toBe(4);
      expect(decodeTrashCursor(result.nextCursor ?? undefined)).toEqual({
        id: 'c1',
        trashedAt: T('2026-03-01T00:00:00.000Z'),
      });
    });

    it('asks every model for the same keyset window when a cursor is supplied', async () => {
      const cursor = encodeTrashCursor({ trashedAt: T('2026-03-01T00:00:00.000Z'), id: 'c1' });
      prisma.contentEntry.findMany.mockResolvedValue([
        { id: 'c2', trashedAt: T('2026-02-01T00:00:00.000Z'), trashedByUserId: null, locales: [] },
      ]);

      const result = await service.list({ limit: 2, cursor });

      for (const model of TRASH_MODELS) {
        const args = delegateFor(model).findMany.mock.calls[0]?.[0] as {
          where: { OR: unknown[] };
          take: number;
        };
        expect(args.where.OR).toEqual([
          { trashedAt: { lt: T('2026-03-01T00:00:00.000Z') } },
          { trashedAt: T('2026-03-01T00:00:00.000Z'), id: { lt: 'c1' } },
        ]);
        expect(args.take).toBe(3);
      }
      expect(result.items.map((i) => i.id)).toEqual(['c2']);
      expect(result.nextCursor).toBeNull();
    });

    it('rejects a cursor it did not issue', async () => {
      await expect(service.list({ cursor: 'not-a-cursor' })).rejects.toThrow(BadRequestException);
    });

    it('queries only the requested model', async () => {
      await service.list({ model: 'form', limit: 5 });

      expect(prisma.form.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.contentEntry.findMany).not.toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.mediaFile.findMany).not.toHaveBeenCalled();
    });

    it('reports the deleting user when the delete path recorded one', async () => {
      prisma.mediaFile.findMany.mockResolvedValue([
        {
          id: 'm1',
          originalName: 'photo.jpg',
          trashedAt: T('2026-04-01T00:00:00.000Z'),
          trashedByUserId: 'admin1',
        },
      ]);

      const { items } = await service.list({ model: 'media' });

      expect(items[0]).toMatchObject({ name: 'photo.jpg', trashedByUserId: 'admin1' });
    });

    it('resolves the deleting user to a readable name (TRASH-03)', async () => {
      prisma.mediaFile.findMany.mockResolvedValue([
        {
          id: 'm1',
          originalName: 'photo.jpg',
          trashedAt: T('2026-04-01T00:00:00.000Z'),
          trashedByUserId: 'admin1',
        },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'admin1', email: 'a@k.local', firstName: 'Ada', lastName: 'Lovelace' },
      ]);

      const { items } = await service.list({ model: 'media' });

      expect(items[0]?.trashedByName).toBe('Ada Lovelace');
      // One lookup for the page, not one per row.
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['admin1'] } },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
    });

    it('falls back to the email when the account has no name', async () => {
      prisma.mediaFile.findMany.mockResolvedValue([
        {
          id: 'm1',
          originalName: 'photo.jpg',
          trashedAt: T('2026-04-01T00:00:00.000Z'),
          trashedByUserId: 'admin1',
        },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'admin1', email: 'a@k.local', firstName: null, lastName: null },
      ]);

      const { items } = await service.list({ model: 'media' });

      expect(items[0]?.trashedByName).toBe('a@k.local');
    });

    it('reports a null name rather than inventing one when no actor was recorded', async () => {
      prisma.mediaFile.findMany.mockResolvedValue([
        {
          id: 'm1',
          originalName: 'photo.jpg',
          trashedAt: T('2026-04-01T00:00:00.000Z'),
          trashedByUserId: null,
        },
      ]);

      const { items } = await service.list({ model: 'media' });

      expect(items[0]?.trashedByName).toBeNull();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('reactivates a restored user, because trashing deactivated it', async () => {
      await service.restore('user', 'u1', SUPER_ADMIN);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          trashedAt: null,
          trashedByUserId: null,
          isActive: true,
          preTrashIsActive: null,
        },
      });
    });

    it('does not touch isActive for models that do not have it deactivated', async () => {
      await service.restore('content', 'c1', ADMIN);

      expect(prisma.contentEntry.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { trashedAt: null, trashedByUserId: null, status: 'DRAFT' },
      });
    });

    it('refuses to restore something that is not in the trash', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.restore('user', 'u1', SUPER_ADMIN)).rejects.toThrow(NotFoundException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('refuses to reactivate an account ranked at or above the caller (BR-USR-006)', async () => {
      prisma.user.findFirst.mockResolvedValue(withRoles('admin'));

      await expect(service.restore('user', 'u1', ADMIN)).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(audit.logAction).not.toHaveBeenCalled();
    });

    it('lets a super admin restore the admin they trashed', async () => {
      prisma.user.findFirst.mockResolvedValue(withRoles('admin'));

      await service.restore('user', 'u1', SUPER_ADMIN);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: {
          trashedAt: null,
          trashedByUserId: null,
          isActive: true,
          preTrashIsActive: null,
        },
      });
    });

    it('refuses a caller holding trash:restore but no system rank', async () => {
      prisma.user.findFirst.mockResolvedValue(withRoles('viewer'));

      await expect(service.restore('user', 'u1', CUSTOM)).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('does not rank-check the models that carry no privilege', async () => {
      await service.restore('form', 'f1', ADMIN);

      expect(prisma.form.update).toHaveBeenCalled();
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('permanentDelete', () => {
    it('refuses to destroy an account ranked at or above the caller', async () => {
      prisma.user.findFirst.mockResolvedValue(withRoles('super_admin'));

      await expect(service.permanentDelete('user', 'u1', ADMIN)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it('lets a super admin destroy a trashed account', async () => {
      prisma.user.findFirst.mockResolvedValue(withRoles('admin'));

      await service.permanentDelete('user', 'u1', SUPER_ADMIN);

      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    });
  });

  describe('purgeExpired', () => {
    const now = T('2026-05-01T00:00:00.000Z');
    const cutoff = new Date(now.getTime() - TRASH_RETENTION_MS);

    beforeEach(() => {
      prisma.contentEntry.findMany.mockResolvedValue([{ id: 'c1' }]);
      prisma.mediaFile.findMany.mockResolvedValue([{ id: 'm1' }]);
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
      prisma.form.findMany.mockResolvedValue([{ id: 'f1' }]);
    });

    it('purges every recoverable model, not just content and media', async () => {
      const summary = await service.purgeExpired(now);

      expect(prisma.contentEntry.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
      expect(media.purge).toHaveBeenCalledWith('m1');
      expect(prisma.mediaFile.delete).not.toHaveBeenCalled();
      expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
      expect(prisma.form.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });
      expect(summary.cutoff).toEqual(cutoff);
      expect(summary.models).toEqual({
        content: { deleted: 1, failed: 0 },
        media: { deleted: 1, failed: 0 },
        user: { deleted: 1, failed: 0 },
        form: { deleted: 1, failed: 0 },
      });
    });

    it('selects only records whose retention has expired', async () => {
      await service.purgeExpired(now);

      for (const model of TRASH_MODELS) {
        expect(delegateFor(model).findMany).toHaveBeenCalledWith({
          where: { trashedAt: { lte: cutoff } },
          select: { id: true },
        });
      }
    });

    it('reports a row the database refuses to delete instead of aborting the purge', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
      prisma.user.delete.mockRejectedValueOnce(new Error('foreign key constraint'));

      const summary = await service.purgeExpired(now);

      expect(summary.models.user).toEqual({ deleted: 1, failed: 1 });
      expect(summary.models.form).toEqual({ deleted: 1, failed: 0 });
      expect(prisma.form.delete).toHaveBeenCalled();
    });

    it('releases the stored object when media is purged, not just the row', async () => {
      await service.purgeExpired(now);

      // Soft delete deliberately keeps the bytes so restore works; purge is the
      // only path that frees them, so it must not bypass MediaService.
      expect(media.purge).toHaveBeenCalledWith('m1');
      expect(prisma.mediaFile.delete).not.toHaveBeenCalled();
    });

    it('reports a media row whose storage purge failed instead of aborting', async () => {
      media.purge.mockRejectedValueOnce(new Error('bucket unreachable'));

      const summary = await service.purgeExpired(now);

      expect(summary.models.media).toEqual({ deleted: 0, failed: 1 });
      expect(summary.models.user).toEqual({ deleted: 1, failed: 0 });
    });

    it('audits each purged record without an actor', async () => {
      await service.purgeExpired(now);

      expect(audit.logAction).toHaveBeenCalledTimes(4);
      expect(audit.logAction).toHaveBeenCalledWith({
        action: 'PERMANENT_DELETE',
        resource: 'user',
        resourceId: 'u1',
        changes: { reason: 'retention', cutoff: cutoff.toISOString() },
      });
    });
  });
});
