import { ForbiddenException } from '@nestjs/common';
import { ROLE_HIERARCHY, SYSTEM_ROLES, type SystemRole } from '../constants/roles.constants';

/** Highest role rank a set of role names maps to (0 if none are system roles). */
export function highestRoleRank(roleNames: string[]): number {
  return roleNames.reduce((max, name) => {
    const rank = ROLE_HIERARCHY[name as SystemRole];
    return rank && rank > max ? rank : max;
  }, 0);
}

/**
 * BR-USR-006: outside SUPER_ADMIN, an actor may only act on an account ranked
 * strictly below their own. Every route that can re-enable, re-role or destroy
 * an account has to apply this, not only the ones under `/users` — an unranked
 * actor (a custom role with no system role) therefore manages nobody.
 */
export function assertCanManageUser(actorRoles: string[], targetRoles: string[]): void {
  if (actorRoles.includes(SYSTEM_ROLES.SUPER_ADMIN)) return;
  if (highestRoleRank(targetRoles) >= highestRoleRank(actorRoles)) {
    throw new ForbiddenException('You cannot manage a user with an equal or higher role');
  }
}
