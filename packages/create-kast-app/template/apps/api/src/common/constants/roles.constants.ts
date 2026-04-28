export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export const ROLE_HIERARCHY: Record<SystemRole, number> = {
  [SYSTEM_ROLES.SUPER_ADMIN]: 4,
  [SYSTEM_ROLES.ADMIN]: 3,
  [SYSTEM_ROLES.EDITOR]: 2,
  [SYSTEM_ROLES.VIEWER]: 1,
};

export function hasRequiredRole(userRoles: string[], requiredRoles: string[]): boolean {
  if (requiredRoles.length === 0) return true;
  return requiredRoles.some((required) => userRoles.includes(required));
}
