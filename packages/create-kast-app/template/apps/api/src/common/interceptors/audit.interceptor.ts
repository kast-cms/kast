import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Prisma } from '@prisma/client';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService, type LogActionParams } from '../../modules/audit/audit.service';
import { AUDIT_ACTION_KEY } from '../decorators/audit-action.decorator';
import type { AuthUser } from '../types/auth.types';
import { redactSensitive } from '../utils/redact.util';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const METHOD_VERB: Record<string, string> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

// Path segments that are API plumbing rather than resource names.
const SKIP_SEGMENTS = new Set(['api', 'v1']);

type ResponseWithId = { id?: unknown; data?: { id?: unknown } };

/** Copies only the defined (non-null, non-undefined) values from `source` onto `target`. */
function assignDefined<T extends object>(
  target: T,
  source: Partial<Record<keyof T, unknown>>,
): void {
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value !== null) {
      (target as Record<string, unknown>)[key] = value;
    }
  }
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser; params?: Record<string, string> }>();
    if (!MUTATION_METHODS.has(req.method)) return next.handle();

    const overrideAction = this.reflector.getAllAndOverride<string | undefined>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const { resource, resourceFromPath } = this.deriveResource(req);
    const action = overrideAction ?? `${resource}.${METHOD_VERB[req.method] ?? 'action'}`;
    const beforeBody = this.captureBody(req.body);

    return next.handle().pipe(
      // Only successful (2xx) responses reach `tap`; thrown errors skip it,
      // so failed (4xx/5xx) requests are never written to the audit log.
      tap((response: unknown) => {
        this.write(req, action, resourceFromPath, beforeBody, response);
      }),
    );
  }

  private write(
    req: Request & { user?: AuthUser; params?: Record<string, string> },
    action: string,
    resource: string,
    beforeBody: Prisma.InputJsonValue | undefined,
    response: unknown,
  ): void {
    const user = req.user;
    const after = req.method === 'DELETE' ? undefined : this.captureBody(this.unwrap(response));

    const params: LogActionParams = { action, resource };
    assignDefined(params, {
      resourceId: this.extractParamId(req.params) ?? this.extractResponseId(response),
      userId: user?.id,
      agentTokenId: user?.agentTokenId,
      before: beforeBody,
      after,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.auditService.logAction(params);
  }

  /**
   * Derives a dotted resource name (e.g. `content`, `user`) for the action and
   * a human resource label (e.g. `ContentEntry`) for the `resource` column.
   */
  private deriveResource(req: Request): { resource: string; resourceFromPath: string } {
    const path = (req.route as { path?: string } | undefined)?.path ?? req.path;
    const segments = path
      .split('/')
      .filter((s) => s && !s.startsWith(':') && !SKIP_SEGMENTS.has(s));
    // First meaningful segment is the resource family.
    const head = segments[0] ?? 'unknown';
    // Singularise simple plurals for nicer action names (users -> user).
    const singular = head.endsWith('s') ? head.slice(0, -1) : head;
    return { resource: singular, resourceFromPath: head };
  }

  private extractParamId(params?: Record<string, string>): string | null {
    if (!params) return null;
    return params['id'] ?? params['itemId'] ?? params['permissionId'] ?? null;
  }

  private extractResponseId(response: unknown): string | null {
    if (!response || typeof response !== 'object') return null;
    const r = response as ResponseWithId;
    if (typeof r.id === 'string') return r.id;
    if (r.data && typeof r.data === 'object' && typeof r.data.id === 'string') return r.data.id;
    return null;
  }

  private unwrap(response: unknown): unknown {
    if (response && typeof response === 'object' && 'data' in response) {
      return (response as { data: unknown }).data;
    }
    return response;
  }

  private captureBody(body: unknown): Prisma.InputJsonValue | undefined {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
    if (Object.keys(body as Record<string, unknown>).length === 0) return undefined;
    return redactSensitive(body) as Prisma.InputJsonValue;
  }
}
