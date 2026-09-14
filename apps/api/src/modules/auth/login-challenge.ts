import { UnauthorizedException } from '@nestjs/common';
import type { User } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import type { SessionMetadata, TwoFactorChallenge } from '../../common/types/auth.types';
import type { QueueAdapter } from '../queue/queue.adapter';
import type { AuthRepository } from './auth.repository';
import type { TwoFactorService } from './two-factor.service';

function key(raw: string): string {
  return `mfa:${createHash('sha256').update(raw).digest('hex')}`;
}
export async function issueLoginChallenge(
  user: User,
  metadata: SessionMetadata,
  queue: QueueAdapter,
): Promise<TwoFactorChallenge> {
  const challengeToken = randomBytes(32).toString('base64url');
  await queue.setEphemeral(
    key(challengeToken),
    JSON.stringify({
      userId: user.id,
      passwordHash: user.passwordHash,
      secret: user.twoFactorSecret,
      metadata,
    }),
    300_000,
  );
  return { requiresTwoFactor: true, challengeToken };
}

export async function verifyLoginChallenge(
  challengeToken: string,
  code: string,
  queue: QueueAdapter,
  repo: AuthRepository,
  twoFactor: TwoFactorService,
): Promise<{ user: User & { roles: { role: { name: string } }[] }; metadata: SessionMetadata }> {
  // A failed attempt consumes the challenge too, bounding guesses per primary authentication.
  const pending = await queue.consumeEphemeral(key(challengeToken));
  if (!pending) throw new UnauthorizedException('Challenge expired. Sign in again');
  const challenge = JSON.parse(pending) as {
    userId: string;
    passwordHash: string | null;
    secret: string;
    metadata: SessionMetadata;
  };
  const user = await repo.findUserById(challenge.userId);
  if (
    !user?.isActive ||
    user.trashedAt ||
    user.passwordHash !== challenge.passwordHash ||
    user.twoFactorSecret !== challenge.secret
  )
    throw new UnauthorizedException('Account changed. Sign in again');
  await twoFactor.verify(user.id, code);
  return { user, metadata: challenge.metadata };
}
