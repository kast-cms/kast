import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenScope } from '@prisma/client';
import type { Request } from 'express';
import { deriveRouteTarget, type RouteTarget } from '../authorization/route-permission.util';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthUser } from '../types/auth.types';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Denials carry a stable machine-readable `code` alongside a human message.
 * GlobalExceptionFilter surfaces the code as `error.code`, so a client can
 * branch on the reason instead of string-matching prose.
 */
function deny(code: string, message: string): ForbiddenException {
  return new ForbiddenException({ code, message });
}

/**
 * Constrains machine credentials, which authenticate with their owner's roles
 * and would otherwise inherit the owner's full access:
 * agent tokens are confined to the MCP transport (P0-03) and API tokens are
 * held to the scope they were minted with (P0-02).
 */
@Injectable()
export class TokenPolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const user = request.user;

    if (!user) return true;
    if (targetIsMcp(context, request, this.reflector) && !user.isAgentToken) {
      throw deny('MCP_AGENT_TOKEN_REQUIRED', 'The MCP transport requires an agent token');
    }
    if (!user.isAgentToken && !user.isApiToken) return true;

    const target = deriveRouteTarget(context, request, this.reflector);

    if (user.isAgentToken) {
      // Per-tool scope stays with McpService; this only bounds the transport.
      if (!target.isMcp) {
        throw deny(
          'AGENT_TOKEN_NOT_ALLOWED',
          'Agent tokens may only be used against the MCP transport',
        );
      }
      return true;
    }

    return this.checkApiTokenScope(user, request.method, target);
  }

  private checkApiTokenScope(user: AuthUser, method: string, target: RouteTarget): boolean {
    switch (user.apiTokenScope) {
      case TokenScope.FULL_ACCESS:
        return true;
      case TokenScope.READ_ONLY:
        if (SAFE_METHODS.has(method.toUpperCase())) return true;
        throw deny('READ_ONLY_TOKEN', 'This API token is read-only');
      case TokenScope.SCOPED:
        if (!target.resolved) {
          throw deny(
            'TOKEN_SCOPE_UNRESOLVED',
            'This route could not be resolved to a permission, so the scoped token is refused',
          );
        }
        if (scopeDataAllows(user.apiTokenScopeData, target)) return true;
        throw deny(
          'TOKEN_SCOPE_DENIED',
          `This API token is not scoped for ${target.resource}:${target.action}`,
        );
      case undefined:
      default:
        throw deny('TOKEN_SCOPE_UNKNOWN', 'This API token has no usable scope');
    }
  }
}

function targetIsMcp(context: ExecutionContext, request: Request, reflector: Reflector): boolean {
  return deriveRouteTarget(context, request, reflector).isMcp;
}

/** `scopeData` maps a resource to the actions it grants; `*` is allowed on either side. */
export function scopeDataAllows(
  scopeData: Record<string, string[]> | undefined,
  target: RouteTarget,
): boolean {
  if (!scopeData || typeof scopeData !== 'object') return false;
  const scopedResource = target.scopeValue
    ? `${target.resource}:${target.scopeValue}`
    : target.resource;
  const actions =
    scopeData[scopedResource] ??
    (target.scopeValue ? scopeData[`${target.resource}:*`] : scopeData[target.resource]) ??
    scopeData['*'];
  if (!Array.isArray(actions)) return false;
  return actions.includes(target.action) || actions.includes('*');
}
