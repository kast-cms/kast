import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { AUDIT_ACTION_KEY } from '../decorators/audit-action.decorator';
import type { AuthUser } from '../types/auth.types';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    if (!MUTATION_METHODS.has(req.method)) return next.handle();

    const action = this.reflector.getAllAndOverride<string | undefined>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) return next.handle();

    const user = req.user;

    return next.handle().pipe(
      tap(() => {
        this.auditService.logAction({
          action,
          resource: action,
          ...(user?.id ? { userId: user.id } : {}),
          ...(req.ip ? { ipAddress: req.ip } : {}),
          ...(req.headers['user-agent'] ? { userAgent: req.headers['user-agent'] } : {}),
        });
      }),
    );
  }
}
