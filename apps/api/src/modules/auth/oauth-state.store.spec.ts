import type { Request } from 'express';
import type { QueueAdapter } from '../queue/queue.adapter';
import { OAuthStateStore } from './oauth-state.store';

describe('OAuth browser binding', () => {
  it('requires the matching cookie and consumes shared state once', async () => {
    const entries = new Map<string, string>();
    const queue = {
      setEphemeral: jest.fn(async (key: string, value: string) => {
        entries.set(key, value);
      }),
      consumeEphemeral: jest.fn(async (key: string) => {
        const value = entries.get(key);
        entries.delete(key);
        return value ?? null;
      }),
    } as unknown as QueueAdapter;
    const stateStore = new OAuthStateStore(queue, 'google', true);
    const req = {
      headers: {},
      res: { cookie: jest.fn(), clearCookie: jest.fn() },
    } as unknown as Request;
    const state = await new Promise<string>((resolve, reject) =>
      stateStore.store(req, (error, value) => (error ? reject(error) : resolve(value ?? ''))),
    );
    expect(req.res?.cookie).toHaveBeenCalledWith(
      'kast_oauth_google',
      state,
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax' }),
    );
    const verify = (): Promise<boolean | undefined> =>
      new Promise((resolve, reject) =>
        stateStore.verify(req, state, (error, valid) => (error ? reject(error) : resolve(valid))),
      );
    await expect(verify()).resolves.toBe(false);
    req.headers.cookie = `kast_oauth_google=${state}`;
    await expect(verify()).resolves.toBe(true);
    await expect(verify()).resolves.toBe(false);
  });
});
