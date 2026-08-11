import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { promises as fs, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import type { Env } from '../../../config/env.schema';
import { LocalStorageAdapter } from './local-storage.adapter';

function adapterFor(values: Partial<Record<keyof Env, unknown>>): LocalStorageAdapter {
  const config = {
    get: (key: keyof Env) => values[key],
  } as unknown as ConfigService<Env>;
  return new LocalStorageAdapter(config);
}

describe('LocalStorageAdapter', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kast-local-storage-'));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  describe('public URLs (MED-01)', () => {
    it('points the legacy /uploads default at the route the API actually serves', () => {
      const adapter = adapterFor({
        STORAGE_LOCAL_DIR: dir,
        STORAGE_LOCAL_URL: 'http://localhost:3000/uploads',
      });

      return expect(adapter.getSignedUrl('abc.png', 60)).resolves.toBe(
        'http://localhost:3000/api/v1/media/files/abc.png',
      );
    });

    it('leaves a deliberately configured base URL alone', async () => {
      const adapter = adapterFor({
        STORAGE_LOCAL_DIR: dir,
        STORAGE_LOCAL_URL: 'https://cdn.example.com/uploads/',
      });

      const { url } = await adapter.upload('abc.png', Buffer.from('x'), 'image/png');
      expect(url).toBe('https://cdn.example.com/uploads/abc.png');
    });

    it('warns when a base URL points at /uploads on a host that is not rewritten', () => {
      // The exact shape render.yaml used to ship: the API's own origin on a
      // path nothing serves, so every media URL 404s. It cannot be corrected
      // automatically (a CDN may serve /uploads), so it has to be said aloud.
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      adapterFor({
        STORAGE_LOCAL_DIR: dir,
        STORAGE_LOCAL_URL: 'https://kast-api.onrender.com/uploads',
      });

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('/api/v1/media/files'));
      warn.mockRestore();
    });

    it('stays quiet for a base URL that is served', () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      adapterFor({
        STORAGE_LOCAL_DIR: dir,
        STORAGE_LOCAL_URL: 'https://kast-api.onrender.com/api/v1/media/files',
      });
      // ...and for the legacy value, which is silently rewritten onto that route.
      adapterFor({ STORAGE_LOCAL_DIR: dir, STORAGE_LOCAL_URL: 'http://localhost:3000/uploads' });

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('provider identity (MED-03)', () => {
    it('reports itself as local', () => {
      expect(adapterFor({ STORAGE_LOCAL_DIR: dir }).provider).toBe('local');
    });
  });

  describe('resolveObject', () => {
    it('resolves a stored object inside the upload directory', async () => {
      const adapter = adapterFor({ STORAGE_LOCAL_DIR: dir });
      await adapter.upload('nested/file.png', Buffer.from('png'), 'image/png');

      const resolved = await adapter.resolveObject('nested/file.png');

      expect(resolved).not.toBeNull();
      const { root, relativePath } = resolved ?? { root: '', relativePath: '' };
      expect(relativePath).toBe(join('nested', 'file.png'));
      expect(resolve(root, relativePath)).toBe(await fs.realpath(join(dir, 'nested/file.png')));
    });

    it.each([
      ['parent traversal', '../secret.txt'],
      ['embedded traversal', 'a/../../secret.txt'],
      ['absolute escape', '/etc/passwd'],
      ['dotfile', '.env'],
      ['backslash', '..\\secret.txt'],
      ['NUL byte', 'file.png\u0000.txt'],
      ['empty key', ''],
    ])('rejects %s', async (_label, key) => {
      const adapter = adapterFor({ STORAGE_LOCAL_DIR: dir });
      await expect(adapter.resolveObject(key)).resolves.toBeNull();
    });

    it('rejects a symlink that points outside the upload directory', async () => {
      const outside = mkdtempSync(join(tmpdir(), 'kast-outside-'));
      await fs.writeFile(join(outside, 'secret.txt'), 'top secret');
      await fs.symlink(join(outside, 'secret.txt'), join(dir, 'link.txt'));

      const adapter = adapterFor({ STORAGE_LOCAL_DIR: dir });
      await expect(adapter.resolveObject('link.txt')).resolves.toBeNull();

      await fs.rm(outside, { recursive: true, force: true });
    });

    it('rejects a directory', async () => {
      await fs.mkdir(join(dir, 'folder'));
      const adapter = adapterFor({ STORAGE_LOCAL_DIR: dir });
      await expect(adapter.resolveObject('folder')).resolves.toBeNull();
    });

    it('returns null for a key that does not exist', async () => {
      const adapter = adapterFor({ STORAGE_LOCAL_DIR: dir });
      await expect(adapter.resolveObject('missing.png')).resolves.toBeNull();
    });
  });

  describe('upload', () => {
    it('refuses to write a key that escapes the upload directory', async () => {
      const adapter = adapterFor({ STORAGE_LOCAL_DIR: dir });
      await expect(adapter.upload('../escaped.png', Buffer.from('x'), 'image/png')).rejects.toThrow(
        /unsafe storage key/,
      );
    });
  });
});
