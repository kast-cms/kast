import type { ExecutionContext } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import type { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export interface RouteTarget {
  resource: string;
  action: string;
  scopeValue?: string;
  isMcp: boolean;
  resolved: boolean;
}

// Path segments that are API plumbing rather than resource names.
const SKIP_SEGMENTS = new Set(['api', 'v1']);

// Maps rather than object literals: a lookup key arrives from the request, and
// an inherited `Object.prototype` member would otherwise answer as a mapping.
const METHOD_ACTION = new Map<string, string>([
  ['GET', 'read'],
  ['HEAD', 'read'],
  ['OPTIONS', 'read'],
  ['POST', 'create'],
  ['PUT', 'update'],
  ['PATCH', 'update'],
  ['DELETE', 'delete'],
]);

// Trailing static segments that name an operation rather than a sub-resource.
// They override the method-derived action so a grant stays expressible as a
// single resource:action pair (docs/architecture/KAST_SECURITY_MODEL.md §6).
const ACTION_SUFFIXES = new Set([
  'publish',
  'unpublish',
  'archive',
  'restore',
  'schedule',
  'revert',
  'locale',
  'duplicate',
  'enable',
  'disable',
  'register',
  'test',
  'validate',
  'import',
  'export',
  'revoke',
  'permanent-delete',
]);

// Sub-actions that perform an operation another route already names, so they
// have to derive to that route's action: a bulk or aliased route must require
// exactly the permission its single-entry equivalent requires.
const SUFFIX_ACTION_ALIASES = new Map<string, string>([
  // POST .../entries/bulk/trash is DELETE .../entries/:id, batched.
  ['trash', 'delete'],
  // POST .../entries/:id/unarchive and its deprecated :id/restore alias.
  ['unarchive', 'restore'],
]);

// Segments that exist only to carry a sub-action. A route underneath one whose
// verb maps to nothing has no derivable permission, so it stays unresolved and
// every scope check fails closed rather than falling back to the HTTP method.
const ACTION_ONLY_SEGMENTS = new Set(['bulk']);

const UNRESOLVED: RouteTarget = { resource: '', action: '', isMcp: false, resolved: false };

/** Derives a resource/action pair from a route path and HTTP method. */
export function routeTargetFromPath(
  path: string,
  method: string,
  params?: Record<string, unknown>,
): RouteTarget {
  const segments = path.split('/').filter((s) => s && !s.startsWith(':') && !SKIP_SEGMENTS.has(s));

  const head = segments[0];
  if (!head) return UNRESOLVED;

  const action = deriveAction(segments, method);
  if (!action) return UNRESOLVED;

  // The content controller is mounted under the content-type it operates on;
  // its resource is `content`, not `content-types`.
  const resource = head === 'content-types' && segments.includes('entries') ? 'content' : head;
  const rawScope = params?.['typeSlug'];
  const scopeValue = typeof rawScope === 'string' && rawScope.length > 0 ? rawScope : undefined;

  return {
    resource,
    action,
    ...(scopeValue ? { scopeValue } : {}),
    isMcp: resource === 'mcp',
    resolved: true,
  };
}

function deriveAction(segments: string[], method: string): string | undefined {
  const last = segments[segments.length - 1];
  if (segments.length > 1 && last) {
    const alias = SUFFIX_ACTION_ALIASES.get(last);
    if (alias) return alias;
    if (ACTION_SUFFIXES.has(last)) return last;
    if (segments.some((segment) => ACTION_ONLY_SEGMENTS.has(segment))) return undefined;
  }
  return METHOD_ACTION.get(method.toUpperCase());
}

/**
 * Resolves the route target for the current request. Controller/handler route
 * metadata is preferred over `req.route` because it is stable regardless of how
 * the HTTP adapter rewrites the matched path.
 */
export function deriveRouteTarget(
  context: ExecutionContext,
  req: Request,
  reflector: Reflector,
): RouteTarget {
  const candidates = [
    joinMetadataPath(
      readPathMetadata(reflector, context.getClass()),
      readPathMetadata(reflector, context.getHandler()),
    ),
    (req.route as { path?: string } | undefined)?.path,
    req.path,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const target = routeTargetFromPath(candidate, req.method, req.params);
    if (target.resolved) return target;
  }

  return UNRESOLVED;
}

function readPathMetadata(reflector: Reflector, target: unknown): string | undefined {
  if (typeof target !== 'function') return undefined;
  const value = reflector.get<string | string[] | undefined>(
    PATH_METADATA,
    target as Parameters<Reflector['get']>[1],
  );
  if (Array.isArray(value)) return value[0];
  return value;
}

function joinMetadataPath(
  controllerPath: string | undefined,
  handlerPath: string | undefined,
): string | undefined {
  if (controllerPath === undefined) return undefined;
  return `${controllerPath}/${handlerPath ?? ''}`;
}
