import { TokenScope } from '@prisma/client';
import type { Request } from 'express';
import type { AuthUser } from '../../../common/types/auth.types';
import type { AuthRepository } from '../auth.repository';
import { ApiTokenStrategy } from './api-token.strategy';

type ApiTokenRecord = Awaited<ReturnType<AuthRepository['findApiToken']>>;

function makeRecord(overrides: Record<string, unknown> = {}): ApiTokenRecord {
  return {
    id: 'token-1',
    scope: TokenScope.FULL_ACCESS,
    scopeData: null,
    expiresAt: null,
    revokedAt: null,
    user: {
      id: 'user-1',
      email: 'admin@kast.local',
      isActive: true,
      roles: [{ role: { name: 'admin' } }],
    },
    ...overrides,
  } as unknown as ApiTokenRecord;
}

function buildStrategy(record: ApiTokenRecord): {
  strategy: ApiTokenStrategy;
  success: jest.Mock;
  fail: jest.Mock;
  updateApiTokenLastUsed: jest.Mock;
} {
  const updateApiTokenLastUsed = jest.fn();
  const repo = {
    findApiToken: jest.fn().mockResolvedValue(record),
    updateApiTokenLastUsed,
  } as unknown as AuthRepository;
  const strategy = new ApiTokenStrategy(repo);
  const success = jest.fn();
  const fail = jest.fn();
  Object.assign(strategy, { success, fail });
  return { strategy, success, fail, updateApiTokenLastUsed };
}

function request(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

describe('ApiTokenStrategy', () => {
  it('fails when no token header is present', async () => {
    const { strategy, success, fail } = buildStrategy(makeRecord());
    await strategy.authenticate(request({}));
    expect(success).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith({ message: 'No api token' }, 401);
  });

  it('carries the token scope onto the principal', async () => {
    const { strategy, success } = buildStrategy(makeRecord({ scope: TokenScope.READ_ONLY }));
    await strategy.authenticate(request({ 'x-kast-key': 'kast_abc' }));
    expect(success).toHaveBeenCalledWith(
      expect.objectContaining<Partial<AuthUser>>({
        id: 'user-1',
        roles: ['admin'],
        isApiToken: true,
        apiTokenId: 'token-1',
        apiTokenScope: TokenScope.READ_ONLY,
      }),
    );
  });

  it('carries scopeData for a SCOPED token', async () => {
    const { strategy, success } = buildStrategy(
      makeRecord({ scope: TokenScope.SCOPED, scopeData: { content: ['read'] } }),
    );
    await strategy.authenticate(request({ authorization: 'Bearer kast_abc' }));
    expect(success).toHaveBeenCalledWith(
      expect.objectContaining({ apiTokenScopeData: { content: ['read'] } }),
    );
  });

  it('omits scopeData when the stored value is not an object map', async () => {
    const { strategy, success } = buildStrategy(
      makeRecord({ scope: TokenScope.SCOPED, scopeData: ['content'] }),
    );
    await strategy.authenticate(request({ 'x-kast-key': 'kast_abc' }));
    expect(success.mock.calls[0]?.[0]).not.toHaveProperty('apiTokenScopeData');
  });

  it('rejects an expired token', async () => {
    const { strategy, success, fail } = buildStrategy(
      makeRecord({ expiresAt: new Date(Date.now() - 1000) }),
    );
    await strategy.authenticate(request({ 'x-kast-key': 'kast_abc' }));
    expect(success).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith({ message: 'Invalid api token' }, 401);
  });

  it('accepts a token whose expiry is still in the future', async () => {
    const { strategy, success } = buildStrategy(
      makeRecord({ expiresAt: new Date(Date.now() + 60_000) }),
    );
    await strategy.authenticate(request({ 'x-kast-key': 'kast_abc' }));
    expect(success).toHaveBeenCalled();
  });

  it('records last-used on a successful authentication', async () => {
    const { strategy, success, updateApiTokenLastUsed } = buildStrategy(makeRecord());
    await strategy.authenticate(request({ 'x-kast-key': 'kast_abc' }));
    expect(success).toHaveBeenCalled();
    expect(updateApiTokenLastUsed).toHaveBeenCalledWith('token-1');
  });

  it('does not record last-used for a rejected token', async () => {
    const { strategy, updateApiTokenLastUsed } = buildStrategy(
      makeRecord({ expiresAt: new Date(Date.now() - 1000) }),
    );
    await strategy.authenticate(request({ 'x-kast-key': 'kast_abc' }));
    expect(updateApiTokenLastUsed).not.toHaveBeenCalled();
  });

  it('rejects a token whose owner is deactivated', async () => {
    const { strategy, success, fail } = buildStrategy(
      makeRecord({
        user: { id: 'user-1', email: 'a@b.c', isActive: false, roles: [] },
      }),
    );
    await strategy.authenticate(request({ 'x-kast-key': 'kast_abc' }));
    expect(success).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith({ message: 'Invalid api token' }, 401);
  });
});
