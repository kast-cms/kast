import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Prisma } from '@prisma/client';
import { Request } from 'express';
import { defer, Observable } from 'rxjs';
import { concatMap, dematerialize, materialize, switchMap } from 'rxjs/operators';
import { AuditService, type LogActionParams } from '../../modules/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
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

const TRAILING_ACTIONS: Record<string, string> = {
  publish: 'publish',
  unpublish: 'unpublish',
  restore: 'restore',
  reorder: 'reorder',
  permissions: 'assign_permissions',
  'permanent-delete': 'permanent_delete',
  'resend-invite': 'resend_invite',
  test: 'test',
  enable: 'enable',
  disable: 'disable',
  register: 'register',
};

// Path segments that are API plumbing rather than resource names.
const SKIP_SEGMENTS = new Set(['api', 'v1']);

type ResponseWithId = { id?: unknown; data?: { id?: unknown } };
type AuditDelegate = {
  findUnique(args: { where: Record<string, string> }): Promise<unknown>;
};
type PersistedLookup = { delegate: AuditDelegate; where: Record<string, string> };

function auditPathSegments(req: Request): string[] {
  const path = (req.route as { path?: string } | undefined)?.path ?? req.path;
  return path.split('/').filter((segment) => {
    return Boolean(segment) && !segment.startsWith(':') && !SKIP_SEGMENTS.has(segment);
  });
}

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
    private readonly prisma: PrismaService,
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

    const { resource, resourceFromPath, trailingAction } = this.deriveResource(req);
    const action =
      overrideAction ?? `${resource}.${trailingAction ?? METHOD_VERB[req.method] ?? 'action'}`;
    const requestBody = this.captureBody(req.body);

    const resourceId = this.extractParamId(req.params);
    return defer(() => this.capturePersisted(resourceFromPath, resourceId, req.params)).pipe(
      switchMap((before) =>
        next.handle().pipe(
          materialize(),
          concatMap(async (notification) => {
            if (notification.kind === 'N') {
              await this.write(
                req,
                action,
                resourceFromPath,
                requestBody,
                before,
                notification.value,
              );
            } else if (notification.kind === 'E') {
              await this.writeFailure(
                req,
                action,
                resourceFromPath,
                requestBody,
                before,
                notification.error,
              );
            }
            return notification;
          }),
          dematerialize(),
        ),
      ),
    );
  }

  private write(
    req: Request & { user?: AuthUser; params?: Record<string, string> },
    action: string,
    resource: string,
    requestBody: Prisma.InputJsonValue | undefined,
    before: Prisma.InputJsonValue | undefined,
    response: unknown,
  ): Promise<void> {
    const user = req.user;
    const resourceId = this.extractParamId(req.params) ?? this.extractResponseId(response);

    const params: LogActionParams = { action, resource };
    assignDefined(params, {
      resourceId,
      userId: user?.id,
      agentTokenId: user?.agentTokenId,
      before,
      changes: this.metadata('success', requestBody),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (req.method === 'DELETE') return this.auditService.logAction(params);
    return this.capturePersisted(resource, resourceId, req.params).then((after) =>
      this.auditService.logAction({ ...params, ...(after ? { after } : {}) }),
    );
  }

  private writeFailure(
    req: Request & { user?: AuthUser; params?: Record<string, string> },
    action: string,
    resource: string,
    requestBody: Prisma.InputJsonValue | undefined,
    before: Prisma.InputJsonValue | undefined,
    error: unknown,
  ): Promise<void> {
    const user = req.user;
    const detail: Record<string, unknown> = {
      outcome: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      ...(error instanceof HttpException ? { statusCode: error.getStatus() } : {}),
      ...(requestBody ? { request: requestBody } : {}),
    };
    const resourceId = this.extractParamId(req.params);
    const params: LogActionParams = {
      action,
      resource,
      changes: detail as Prisma.InputJsonValue,
      ...(before ? { before } : {}),
    };
    assignDefined(params, {
      resourceId,
      userId: user?.id,
      agentTokenId: user?.agentTokenId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return this.capturePersisted(resource, resourceId, req.params).then((after) =>
      this.auditService.logAction({ ...params, ...(after ? { after } : {}) }),
    );
  }

  private metadata(
    outcome: 'success',
    requestBody: Prisma.InputJsonValue | undefined,
  ): Prisma.InputJsonValue {
    return {
      outcome,
      ...(requestBody ? { request: requestBody } : {}),
    } as Prisma.InputJsonValue;
  }

  /**
   * Derives a dotted resource name (e.g. `content`, `user`) for the action and
   * a human resource label (e.g. `ContentEntry`) for the `resource` column.
   */
  private deriveResource(req: Request): {
    resource: string;
    resourceFromPath: string;
    trailingAction?: string;
  } {
    const segments = auditPathSegments(req);
    // First meaningful segment is the resource family.
    const head = segments[0] ?? 'unknown';
    const tail = segments.at(-1) ?? '';
    const trailingAction = TRAILING_ACTIONS[tail];
    if (head === 'content-types' && segments.includes('entries')) {
      return {
        resource: 'content',
        resourceFromPath: 'content-entry',
        ...(trailingAction ? { trailingAction } : {}),
      };
    }
    // Singularise simple plurals for nicer action names (users -> user).
    const singular = head.endsWith('s') ? head.slice(0, -1) : head;
    return {
      resource: singular,
      resourceFromPath: head,
      ...(tail !== head && trailingAction ? { trailingAction } : {}),
    };
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

  private captureBody(body: unknown): Prisma.InputJsonValue | undefined {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
    if (Object.keys(body as Record<string, unknown>).length === 0) return undefined;
    return redactSensitive(body) as Prisma.InputJsonValue;
  }

  private async capturePersisted(
    resource: string,
    id: string | null,
    params?: Record<string, string>,
  ): Promise<Prisma.InputJsonValue | undefined> {
    const lookup = this.persistedLookup(resource, id, params);
    if (!lookup) return undefined;
    const row = await lookup.delegate.findUnique({ where: lookup.where });
    if (!row) return undefined;
    return redactSensitive(JSON.parse(JSON.stringify(row))) as Prisma.InputJsonValue;
  }

  private persistedLookup(
    resource: string,
    id: string | null,
    params?: Record<string, string>,
  ): PersistedLookup | undefined {
    const name = params?.['name'];
    if (resource === 'plugins' && name) return this.namedLookup(this.prisma.plugin, 'name', name);
    const code = params?.['code'];
    if (resource === 'locales' && code) return this.namedLookup(this.prisma.locale, 'code', code);

    const delegates: Record<string, unknown> = {
      'content-entry': this.prisma.contentEntry,
      'content-types': this.prisma.contentType,
      users: this.prisma.user,
      roles: this.prisma.role,
      media: this.prisma.mediaFile,
      webhooks: this.prisma.webhookEndpoint,
      forms: this.prisma.form,
      menus: this.prisma.menu,
      redirects: this.prisma.redirect,
      'agent-tokens': this.prisma.agentToken,
      tokens: this.prisma.apiToken,
      plugins: this.prisma.plugin,
    };
    return id ? this.namedLookup(delegates[resource], 'id', id) : undefined;
  }

  private namedLookup(
    delegate: unknown,
    field: string,
    value: string,
  ): PersistedLookup | undefined {
    return delegate
      ? { delegate: delegate as AuditDelegate, where: { [field]: value } }
      : undefined;
  }
}
