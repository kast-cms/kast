import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { GlobalSetting } from '@prisma/client';
import type { AuthUser } from '../../common/types/auth.types';
import { decryptSecret } from '../../common/utils/secret-crypto.util';
import type { Env } from '../../config/env.schema';
import type { SettingPatch, SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({ sendMail: jest.fn().mockResolvedValue(undefined) }),
}));

const ENCRYPTION_KEY = 'unit-test-encryption-key-0123456789';

function buildRow(overrides: Partial<GlobalSetting> = {}): GlobalSetting {
  return {
    id: 'set1',
    key: 'site.name',
    value: 'Kast CMS',
    group: 'site',
    label: null,
    isPublic: true,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedBy: null,
    ...overrides,
  } as GlobalSetting;
}

function buildUser(roles: string[]): AuthUser {
  return { id: 'user1', email: 'someone@example.com', roles };
}

describe('SettingsService', () => {
  let repo: {
    findAll: jest.Mock;
    findPublic: jest.Mock;
    upsertMany: jest.Mock;
  };
  let service: SettingsService;

  const config = {
    get: jest.fn().mockReturnValue('jwt-secret-fallback-0123456789abcdef'),
  } as unknown as ConfigService<Env>;

  beforeEach(() => {
    process.env.KAST_SECRET_ENCRYPTION_KEY = ENCRYPTION_KEY;
    repo = {
      findAll: jest.fn().mockResolvedValue([]),
      findPublic: jest.fn().mockResolvedValue([]),
      // Echo the patch back the way the database would.
      upsertMany: jest.fn().mockImplementation((patches: SettingPatch[]) =>
        Promise.resolve(
          patches.map(({ key, value, isPublic }) =>
            buildRow({
              key,
              value: value as GlobalSetting['value'],
              isPublic: isPublic ?? false,
            }),
          ),
        ),
      ),
    };
    service = new SettingsService(repo as unknown as SettingsRepository, config);
  });

  afterEach(() => {
    delete process.env.KAST_SECRET_ENCRYPTION_KEY;
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    beforeEach(() => {
      repo.findAll.mockResolvedValue([
        buildRow({ key: 'site.name', value: 'Kast CMS' }),
        buildRow({ id: 'set2', key: 'smtp.password', value: 'enc:v1:a:b:c' }),
      ]);
    });

    it.each(['viewer', 'editor'])('hides secret rows from a %s entirely', async (role) => {
      const rows = await service.getAll(buildUser([role]));

      expect(rows.map((r) => r.key)).toEqual(['site.name']);
      expect(JSON.stringify(rows)).not.toContain('enc:v1');
    });

    it.each(['admin', 'super_admin'])(
      'shows a %s that the secret exists but never its value',
      async (role) => {
        const rows = await service.getAll(buildUser([role]));

        const secret = rows.find((r) => r.key === 'smtp.password');
        expect(secret).toMatchObject({ value: null, isSecret: true, configured: true });
      },
    );

    it('reports an unset secret as not configured', async () => {
      repo.findAll.mockResolvedValue([buildRow({ key: 'smtp.password', value: '' })]);

      const rows = await service.getAll(buildUser(['super_admin']));

      expect(rows[0]).toMatchObject({ value: null, configured: false });
    });

    it('withholds secrets when no user is supplied', async () => {
      const rows = await service.getAll();

      expect(rows.map((r) => r.key)).toEqual(['site.name']);
    });
  });

  describe('getPublicSettings', () => {
    it('never exposes a secret key even if the row is flagged public', async () => {
      repo.findPublic.mockResolvedValue([
        { key: 'site.name', value: 'Kast CMS' },
        { key: 'smtp.password', value: 'hunter2' },
      ]);

      await expect(service.getPublicSettings()).resolves.toEqual({ 'site.name': 'Kast CMS' });
    });
  });

  describe('patch', () => {
    it('encrypts a secret at rest, pins it private, and redacts it from the response', async () => {
      const result = await service.patch(
        { settings: [{ key: 'smtp.password', value: 'hunter2' }] },
        buildUser(['super_admin']),
      );

      const patches = repo.upsertMany.mock.calls[0]?.[0] as SettingPatch[];
      const stored = patches[0]?.value as string;
      expect(stored.startsWith('enc:v1:')).toBe(true);
      expect(stored).not.toContain('hunter2');
      expect(patches[0]?.isPublic).toBe(false);
      expect(decryptSecret(stored, ENCRYPTION_KEY)).toBe('hunter2');
      expect(result[0]).toMatchObject({ value: null, isSecret: true, configured: true });
      expect(JSON.stringify(result)).not.toContain('hunter2');
    });

    it('stores a blank secret verbatim so it reads back as unconfigured', async () => {
      const result = await service.patch(
        { settings: [{ key: 'smtp.password', value: '' }] },
        buildUser(['super_admin']),
      );

      const patches = repo.upsertMany.mock.calls[0]?.[0] as SettingPatch[];
      expect(patches[0]?.value).toBe('');
      expect(result[0]?.configured).toBe(false);
    });

    it('refuses a secret write from a non super_admin', async () => {
      await expect(
        service.patch({ settings: [{ key: 'smtp.password', value: 'x' }] }, buildUser(['admin'])),
      ).rejects.toThrow(ForbiddenException);
      expect(repo.upsertMany).not.toHaveBeenCalled();
    });

    it('rejects a non-string secret value', async () => {
      await expect(
        service.patch(
          { settings: [{ key: 'smtp.password', value: { nested: true } }] },
          buildUser(['super_admin']),
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('leaves non-secret settings untouched', async () => {
      await service.patch(
        { settings: [{ key: 'site.name', value: 'Renamed' }] },
        buildUser(['super_admin']),
      );

      const patches = repo.upsertMany.mock.calls[0]?.[0] as SettingPatch[];
      expect(patches[0]).toEqual({ key: 'site.name', value: 'Renamed' });
    });
  });

  describe('testSmtp', () => {
    const nodemailer = jest.requireMock('nodemailer') as { createTransport: jest.Mock };

    function smtpRows(password: string): GlobalSetting[] {
      return [
        buildRow({ key: 'smtp.host', value: 'smtp.example.com' }),
        buildRow({ id: 's2', key: 'smtp.user', value: 'mailer' }),
        buildRow({ id: 's3', key: 'smtp.password', value: password }),
      ];
    }

    it('decrypts the stored password before handing it to the transport', async () => {
      const patched = await service.patch(
        { settings: [{ key: 'smtp.password', value: 'hunter2' }] },
        buildUser(['super_admin']),
      );
      const stored = (repo.upsertMany.mock.calls[0]?.[0] as SettingPatch[])[0]?.value as string;
      expect(patched[0]?.value).toBeNull();
      repo.findAll.mockResolvedValue(smtpRows(stored));

      await service.testSmtp({ to: 'someone@example.com' });

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ auth: { user: 'mailer', pass: 'hunter2' } }),
      );
    });

    it('keeps a legacy plaintext password working until it is re-saved', async () => {
      repo.findAll.mockResolvedValue(smtpRows('legacy-plaintext'));

      await service.testSmtp({ to: 'someone@example.com' });

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ auth: { user: 'mailer', pass: 'legacy-plaintext' } }),
      );
    });

    it('reports a ciphertext it cannot decrypt instead of sending a blank password', async () => {
      repo.findAll.mockResolvedValue(smtpRows('enc:v1:bm9wZQ==:bm9wZQ==:bm9wZQ=='));

      await expect(service.testSmtp({ to: 'someone@example.com' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
