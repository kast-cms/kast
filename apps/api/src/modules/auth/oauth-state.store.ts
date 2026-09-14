import { createHash, randomBytes } from 'crypto';
import type { Request } from 'express';
import type { QueueAdapter } from '../queue/queue.adapter';

/** Browser-bound, single-use state shared across API replicas; no Express session required. */
export class OAuthStateStore {
  constructor(
    private readonly queue: QueueAdapter,
    private readonly provider: string,
    private readonly secure: boolean,
  ) {}

  store(req: Request, done: (error: Error | null, state?: string) => void): void {
    const state = randomBytes(32).toString('base64url');
    void this.queue
      .setEphemeral(this.key(state), '1', 300_000)
      .then(() => {
        req.res?.cookie(this.cookie(), state, {
          httpOnly: true,
          secure: this.secure,
          sameSite: 'lax',
          path: this.path(),
          maxAge: 300_000,
        });
        done(null, state);
      })
      .catch((error: unknown) =>
        done(error instanceof Error ? error : new Error('Unable to store OAuth state')),
      );
  }

  verify(req: Request, state: string, done: (error: Error | null, valid?: boolean) => void): void {
    const browserState = req.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${this.cookie()}=`))
      ?.slice(this.cookie().length + 1);
    req.res?.clearCookie(this.cookie(), { path: this.path() });
    if (!browserState || !/^[a-zA-Z0-9_-]{43}$/.test(state) || state !== browserState) {
      done(null, false);
      return;
    }
    void this.queue
      .consumeEphemeral(this.key(state))
      .then((stored) => done(null, stored === '1'))
      .catch((error: unknown) =>
        done(error instanceof Error ? error : new Error('Unable to verify OAuth state')),
      );
  }

  private cookie(): string {
    return `kast_oauth_${this.provider}`;
  }
  private path(): string {
    return `/api/v1/auth/oauth/${this.provider}/callback`;
  }
  private key(state: string): string {
    return `oauth-state:${this.provider}:${createHash('sha256').update(state).digest('hex')}`;
  }
}
