import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permission';

export interface RequiredPermission {
  resource: string;
  action: string;
}

/**
 * Overrides the resource/action RolesGuard would otherwise derive from the
 * route path. Optional — routes without it are still permission-checked.
 */
export const RequirePermission = (
  resource: string,
  action: string,
): ReturnType<typeof SetMetadata> => SetMetadata(PERMISSION_KEY, { resource, action });
