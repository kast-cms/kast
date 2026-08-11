import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PermissionResolverService } from '../authorization/permission-resolver.service';
import { deriveRouteTarget, type RouteTarget } from '../authorization/route-permission.util';
import { SYSTEM_ROLES, hasRequiredRole } from '../constants/roles.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  PERMISSION_KEY,
  type RequiredPermission,
} from '../decorators/require-permission.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthUser } from '../types/auth.types';

const SYSTEM_ROLE_NAMES = new Set<string>(Object.values(SYSTEM_ROLES));

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionResolver: PermissionResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const declaredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredRoles = declaredRoles && declaredRoles.length > 0 ? declaredRoles : undefined;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;

    if (!user) {
      if (!requiredRoles) return true;
      throw new ForbiddenException('FORBIDDEN');
    }

    if (this.roleAllows(user.roles, requiredRoles)) return true;

    const target = this.resolveTarget(context, request);
    if (!(await this.permissionResolver.isAllowed(user.roles, target))) {
      throw new ForbiddenException('FORBIDDEN');
    }

    return true;
  }

  private roleAllows(userRoles: string[], requiredRoles: string[] | undefined): boolean {
    if (userRoles.includes(SYSTEM_ROLES.SUPER_ADMIN)) return true;
    if (requiredRoles) return hasRequiredRole(userRoles, requiredRoles);
    // Undecorated routes have always been open to any system-role holder;
    // narrowing that here would change every controller's contract at once.
    return userRoles.some((role) => SYSTEM_ROLE_NAMES.has(role));
  }

  private resolveTarget(context: ExecutionContext, request: Request): RouteTarget {
    const derived = deriveRouteTarget(context, request, this.reflector);
    const override = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!override) return derived;
    return {
      ...derived,
      resource: override.resource,
      action: override.action,
      resolved: true,
    };
  }
}
