import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { hasRequiredRole } from '../constants/roles.constants';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthUser } from '../types/auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;

    if (!user) throw new ForbiddenException('FORBIDDEN');

    if (!hasRequiredRole(user.roles, requiredRoles)) {
      throw new ForbiddenException('FORBIDDEN');
    }

    return true;
  }
}
