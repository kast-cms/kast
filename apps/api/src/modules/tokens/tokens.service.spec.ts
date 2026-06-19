import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TokenScope } from '@prisma/client';
import type { ApiTokenRow, TokensRepository } from './tokens.repository';
import { TokensService } from './tokens.service';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function buildRow(over: Partial<ApiTokenRow> = {}): ApiTokenRow {
  return {
    id: 't1',
    userId: 'owner',
    name: 'CI token',
    prefix: 'kast_abcd',
    scope: TokenScope.READ_ONLY,
    scopeData: null,
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...over,
  } as ApiTokenRow;
}

describe('TokensService', () => {
  let repo: Mocked<TokensRepository>;
  let service: TokensService;

  beforeEach(() => {
    repo = {
      list: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      revoke: jest.fn(),
    } as unknown as Mocked<TokensRepository>;
    service = new TokensService(repo as unknown as TokensRepository);
  });

  describe('list', () => {
    it('maps rows to summaries and never exposes the raw token or hash', async () => {
      repo.list.mockResolvedValue([buildRow({ scopeData: { content: ['read'] } })]);
      const result = await service.list('owner');
      const summary = result.data[0];
      expect(summary?.prefix).toBe('kast_abcd');
      expect(summary?.scopeData).toEqual({ content: ['read'] });
      expect(summary as unknown as Record<string, unknown>).not.toHaveProperty('token');
      expect(summary as unknown as Record<string, unknown>).not.toHaveProperty('tokenHash');
    });
  });

  describe('create', () => {
    it('requires scopeData when scope is SCOPED', async () => {
      await expect(
        service.create('owner', { name: 'x', scope: TokenScope.SCOPED }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('returns the plaintext token exactly once (show-once) alongside the summary', async () => {
      repo.create.mockResolvedValue({ raw: 'kast_abcd.secretpart', record: buildRow() });
      const result = await service.create('owner', {
        name: 'CI token',
        scope: TokenScope.READ_ONLY,
      });
      expect(result.data.token).toBe('kast_abcd.secretpart');
      expect(result.data.prefix).toBe('kast_abcd');
      expect(result.data.id).toBe('t1');
    });

    it('parses an ISO expiry into a Date for the repository', async () => {
      repo.create.mockResolvedValue({ raw: 'raw', record: buildRow() });
      await service.create('owner', {
        name: 'expiring',
        scope: TokenScope.READ_ONLY,
        expiresAt: '2030-01-01T00:00:00.000Z',
      });
      const arg = repo.create.mock.calls[0]?.[1] as { expiresAt: Date | null };
      expect(arg.expiresAt).toBeInstanceOf(Date);
      expect(arg.expiresAt?.toISOString()).toBe('2030-01-01T00:00:00.000Z');
    });

    it('passes scopeData through for SCOPED tokens', async () => {
      repo.create.mockResolvedValue({ raw: 'raw', record: buildRow({ scope: TokenScope.SCOPED }) });
      await service.create('owner', {
        name: 'scoped',
        scope: TokenScope.SCOPED,
        scopeData: { content: ['read', 'write'] },
      });
      const arg = repo.create.mock.calls[0]?.[1] as { scopeData: unknown };
      expect(arg.scopeData).toEqual({ content: ['read', 'write'] });
    });
  });

  describe('revoke', () => {
    it('throws NotFound for a missing token', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.revoke('t1', 'owner')).rejects.toThrow(NotFoundException);
    });

    it("forbids revoking another user's token", async () => {
      repo.findById.mockResolvedValue({ id: 't1', userId: 'someone-else', revokedAt: null });
      await expect(service.revoke('t1', 'owner')).rejects.toThrow(ForbiddenException);
      expect(repo.revoke).not.toHaveBeenCalled();
    });

    it('is idempotent for an already-revoked token', async () => {
      repo.findById.mockResolvedValue({ id: 't1', userId: 'owner', revokedAt: new Date() });
      await service.revoke('t1', 'owner');
      expect(repo.revoke).not.toHaveBeenCalled();
    });

    it("revokes the owner's active token", async () => {
      repo.findById.mockResolvedValue({ id: 't1', userId: 'owner', revokedAt: null });
      await service.revoke('t1', 'owner');
      expect(repo.revoke).toHaveBeenCalledWith('t1');
    });
  });
});
