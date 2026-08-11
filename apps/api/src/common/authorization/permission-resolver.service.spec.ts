import type { PrismaService } from '../../prisma/prisma.service';
import { PermissionResolverService } from './permission-resolver.service';
import type { RouteTarget } from './route-permission.util';

interface PermissionRow {
  permission: { resource: string; action: string; scope: string };
}

function makePrisma(rows: PermissionRow[]): {
  service: PrismaService;
  findMany: jest.Mock;
} {
  const findMany = jest.fn().mockResolvedValue(rows);
  return {
    service: { rolePermission: { findMany } } as unknown as PrismaService,
    findMany,
  };
}

const contentRead: RouteTarget = {
  resource: 'content',
  action: 'read',
  isMcp: false,
  resolved: true,
};

describe('PermissionResolverService', () => {
  it('issues a single query for the role set', async () => {
    const { service, findMany } = makePrisma([
      { permission: { resource: 'content', action: 'read', scope: '*' } },
    ]);
    const resolver = new PermissionResolverService(service);

    await resolver.resolve(['writer']);
    await resolver.resolve(['writer']);

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: { role: { name: { in: ['writer'] } } },
      select: { permission: { select: { resource: true, action: true, scope: true } } },
    });
  });

  it('treats role order and duplicates as the same cache key', async () => {
    const { service, findMany } = makePrisma([]);
    const resolver = new PermissionResolverService(service);

    await resolver.resolve(['b', 'a']);
    await resolver.resolve(['a', 'b', 'a']);

    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent lookups', async () => {
    const { service, findMany } = makePrisma([]);
    const resolver = new PermissionResolverService(service);

    await Promise.all([resolver.resolve(['writer']), resolver.resolve(['writer'])]);

    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('does not query when there are no roles', async () => {
    const { service, findMany } = makePrisma([]);
    const resolver = new PermissionResolverService(service);

    await expect(resolver.resolve([])).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('re-queries once the cache entry expires', async () => {
    jest.useFakeTimers();
    try {
      const { service, findMany } = makePrisma([]);
      const resolver = new PermissionResolverService(service);

      await resolver.resolve(['writer']);
      jest.advanceTimersByTime(30_001);
      await resolver.resolve(['writer']);

      expect(findMany).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('re-queries after invalidate()', async () => {
    const { service, findMany } = makePrisma([]);
    const resolver = new PermissionResolverService(service);

    await resolver.resolve(['writer']);
    resolver.invalidate();
    await resolver.resolve(['writer']);

    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('invalidateRoles only drops entries containing the named role', async () => {
    const { service, findMany } = makePrisma([]);
    const resolver = new PermissionResolverService(service);

    await resolver.resolve(['writer']);
    await resolver.resolve(['reviewer']);
    resolver.invalidateRoles(['writer']);
    await resolver.resolve(['reviewer']);
    await resolver.resolve(['writer']);

    expect(findMany).toHaveBeenCalledTimes(3);
  });

  it('allows a matching grant', async () => {
    const { service } = makePrisma([
      { permission: { resource: 'content', action: 'read', scope: '*' } },
    ]);
    const resolver = new PermissionResolverService(service);

    await expect(resolver.isAllowed(['writer'], contentRead)).resolves.toBe(true);
  });

  it('denies when no grant matches', async () => {
    const { service } = makePrisma([
      { permission: { resource: 'media', action: 'read', scope: '*' } },
    ]);
    const resolver = new PermissionResolverService(service);

    await expect(resolver.isAllowed(['writer'], contentRead)).resolves.toBe(false);
  });

  it('denies an unresolved target without querying', async () => {
    const { service, findMany } = makePrisma([
      { permission: { resource: '*', action: '*', scope: '*' } },
    ]);
    const resolver = new PermissionResolverService(service);

    await expect(
      resolver.isAllowed(['writer'], { resource: '', action: '', isMcp: false, resolved: false }),
    ).resolves.toBe(false);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('honours a content-type scope', async () => {
    const { service } = makePrisma([
      { permission: { resource: 'content', action: 'publish', scope: 'blog-post' } },
    ]);
    const resolver = new PermissionResolverService(service);

    await expect(
      resolver.isAllowed(['writer'], {
        resource: 'content',
        action: 'publish',
        scopeValue: 'blog-post',
        isMcp: false,
        resolved: true,
      }),
    ).resolves.toBe(true);
    await expect(
      resolver.isAllowed(['writer'], {
        resource: 'content',
        action: 'publish',
        scopeValue: 'page',
        isMcp: false,
        resolved: true,
      }),
    ).resolves.toBe(false);
  });
});
