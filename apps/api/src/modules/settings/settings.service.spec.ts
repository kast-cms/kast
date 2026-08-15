import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { GlobalSetting } from '@prisma/client';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SecretEncryptionService } from '../../common/security/secret-encryption.service';
import type { AuthUser } from '../../common/types/auth.types';
import { decryptSecret } from '../../common/utils/secret-crypto.util';
import type { Env } from '../../config/env.schema';
import { LocalStorageAdapter } from '../media/storage/local-storage.adapter';
import type { StorageAdapter } from '../media/storage/storage.adapter';
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
    upsert: jest.Mock;
    upsertMany: jest.Mock;
  };
  let service: SettingsService;
  let storage: {
    provider: string;
    upload: jest.Mock;
    read: jest.Mock;
    delete: jest.Mock;
    getSignedUrl: jest.Mock;
  };
  let storageProvider: string;

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'STORAGE_PROVIDER') return storageProvider;
      if (key === 'KAST_SECRET_ENCRYPTION_KEY') return ENCRYPTION_KEY;
      return 'jwt-secret-fallback-0123456789abcdef';
    }),
  } as unknown as ConfigService<Env>;

  beforeEach(() => {
    process.env.KAST_SECRET_ENCRYPTION_KEY = ENCRYPTION_KEY;
    storageProvider = 'local';
    // Echoes the uploaded bytes back the way a healthy backend would.
    let uploaded: Buffer | null = null;
    storage = {
      provider: 'local',
      upload: jest.fn().mockImplementation((_key: string, buffer: Buffer) => {
        uploaded = buffer;
        return Promise.resolve({ url: 'http://local/probe', storageKey: 'probe' });
      }),
      read: jest.fn().mockImplementation(() => Promise.resolve(uploaded ?? Buffer.alloc(0))),
      delete: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('http://local/probe'),
    };
    repo = {
      findAll: jest.fn().mockResolvedValue([]),
      findPublic: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue(buildRow()),
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
    service = new SettingsService(
      repo as unknown as SettingsRepository,
      config,
      storage as unknown as StorageAdapter,
      new SecretEncryptionService(config),
    );
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

    it('withholds settings no runtime path reads, from a super admin too', async () => {
      repo.findAll.mockResolvedValue([
        buildRow({ key: 'site.name', value: 'Kast CMS' }),
        buildRow({ id: 'set3', key: 'storage.provider', value: 'S3' }),
        buildRow({ id: 'set4', key: 'content.versionRetention', value: 10 }),
      ]);

      const rows = await service.getAll(buildUser(['super_admin']));

      expect(rows.map((r) => r.key)).toEqual(['site.name', 'content.versionRetention']);
    });

    it('says which runtime path reads each setting it does return', async () => {
      repo.findAll.mockResolvedValue([
        buildRow({ key: 'site.maintenanceMode', value: true }),
        buildRow({ id: 'set5', key: 'my.custom.key', value: 'anything' }),
      ]);

      const rows = await service.getAll(buildUser(['super_admin']));

      expect(rows[0]?.enforcedBy).toContain('MaintenanceMiddleware');
      expect(rows[1]?.enforcedBy).toBeNull();
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

    it('drops a legacy row the runtime does not read', async () => {
      repo.findPublic.mockResolvedValue([
        { key: 'site.name', value: 'Kast CMS' },
        { key: 'media.imageQuality', value: 80 },
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

    it('refuses a setting the runtime never reads, and names the real source', async () => {
      await expect(
        service.patch(
          { settings: [{ key: 'storage.provider', value: 'S3' }] },
          buildUser(['super_admin']),
        ),
      ).rejects.toThrow(/STORAGE_PROVIDER/);
      expect(repo.upsertMany).not.toHaveBeenCalled();
    });

    it('refuses the whole batch when one key is inert', async () => {
      await expect(
        service.patch(
          {
            settings: [
              { key: 'site.name', value: 'Renamed' },
              { key: 'cors.allowedOrigins', value: ['https://example.com'] },
            ],
          },
          buildUser(['super_admin']),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.upsertMany).not.toHaveBeenCalled();
    });

    it('publishes a setting when the caller asks for it', async () => {
      await service.patch(
        { settings: [{ key: 'site.name', value: 'Kast', isPublic: true }] },
        buildUser(['super_admin']),
      );

      const patches = repo.upsertMany.mock.calls[0]?.[0] as SettingPatch[];
      expect(patches[0]).toEqual({ key: 'site.name', value: 'Kast', isPublic: true });
    });

    it('keeps a secret private even when the caller asks to publish it', async () => {
      await service.patch(
        { settings: [{ key: 'smtp.password', value: 'hunter2', isPublic: true }] },
        buildUser(['super_admin']),
      );

      const patches = repo.upsertMany.mock.calls[0]?.[0] as SettingPatch[];
      expect(patches[0]?.isPublic).toBe(false);
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

    it('sends from the configured display name and address', async () => {
      const transport = { sendMail: jest.fn().mockResolvedValue(undefined) };
      nodemailer.createTransport.mockReturnValue(transport);
      repo.findAll.mockResolvedValue([
        ...smtpRows('legacy-plaintext'),
        buildRow({ id: 's4', key: 'smtp.from', value: 'noreply@example.com' }),
        buildRow({ id: 's5', key: 'smtp.fromName', value: 'Kast CMS' }),
      ]);

      await service.testSmtp({ to: 'someone@example.com' });

      expect(transport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'Kast CMS <noreply@example.com>' }),
      );
    });
  });

  describe('testStorage', () => {
    it('writes, reads back and removes a probe object through the real adapter', async () => {
      const result = await service.testStorage();

      const key = storage.upload.mock.calls[0]?.[0] as string;
      expect(storage.upload).toHaveBeenCalledTimes(1);
      expect(storage.read).toHaveBeenCalledWith(key);
      expect(storage.delete).toHaveBeenCalledWith(key);
      expect(result).toMatchObject({
        provider: 'LOCAL',
        status: 'ok',
        checks: { write: true, read: true, delete: true },
      });
    });

    it('fails when the backend cannot be written to, and cleans up anyway', async () => {
      storage.upload.mockRejectedValue(new Error('bucket does not exist'));

      await expect(service.testStorage()).rejects.toThrow(/bucket does not exist/);
      expect(storage.delete).toHaveBeenCalledTimes(1);
    });

    it('fails when the object reads back as something else', async () => {
      storage.read.mockResolvedValue(Buffer.from('not what was written', 'utf8'));

      await expect(service.testStorage()).rejects.toThrow(BadRequestException);
    });

    it('reports the configured adapter', async () => {
      storageProvider = 'local';

      const result = await service.testStorage();

      expect(result.provider).toBe('LOCAL');
      expect(result.warning).toBeUndefined();
    });
  });

  // The mocked adapter above accepts any key; the local adapter — the default
  // backend — refuses the ones its own upload path would refuse.
  describe('testStorage against the real LocalStorageAdapter', () => {
    let dir: string;
    let local: SettingsService;

    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'kast-storage-probe-'));
      const adapter = new LocalStorageAdapter({
        get: (key: string) => (key === 'STORAGE_LOCAL_DIR' ? dir : ''),
      } as unknown as ConfigService<Env>);
      local = new SettingsService(
        repo as unknown as SettingsRepository,
        config,
        adapter,
        new SecretEncryptionService(config),
      );
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('writes, reads back and removes a probe the key guard accepts', async () => {
      const result = await local.testStorage();

      expect(result).toMatchObject({
        provider: 'LOCAL',
        status: 'ok',
        checks: { write: true, read: true, delete: true },
      });
      expect(await fs.readdir(join(dir, 'kast-probe'))).toEqual([]);
    });
  });
});
