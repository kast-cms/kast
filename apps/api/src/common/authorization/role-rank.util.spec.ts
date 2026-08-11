import { ForbiddenException } from '@nestjs/common';
import { assertCanManageUser, highestRoleRank } from './role-rank.util';

describe('highestRoleRank', () => {
  it('takes the highest system role in the set', () => {
    expect(highestRoleRank(['viewer', 'admin', 'editor'])).toBe(3);
  });

  it('ignores custom roles, which carry no rank', () => {
    expect(highestRoleRank(['recovery-bot'])).toBe(0);
    expect(highestRoleRank([])).toBe(0);
  });
});

describe('assertCanManageUser', () => {
  it('lets a super admin manage anyone', () => {
    expect(() => assertCanManageUser(['super_admin'], ['super_admin'])).not.toThrow();
  });

  it('refuses a target of equal rank', () => {
    expect(() => assertCanManageUser(['admin'], ['admin'])).toThrow(ForbiddenException);
  });

  it('refuses a target of higher rank', () => {
    expect(() => assertCanManageUser(['admin'], ['super_admin'])).toThrow(ForbiddenException);
  });

  it('allows a strictly lower-ranked target', () => {
    expect(() => assertCanManageUser(['admin'], ['editor'])).not.toThrow();
  });

  it('refuses an actor holding no system role at all', () => {
    expect(() => assertCanManageUser(['recovery-bot'], ['viewer'])).toThrow(ForbiddenException);
    expect(() => assertCanManageUser(['recovery-bot'], [])).toThrow(ForbiddenException);
  });
});
