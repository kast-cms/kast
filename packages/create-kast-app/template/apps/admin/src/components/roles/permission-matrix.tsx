'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { AssignPermissionsBody, Permission } from '@kast-cms/sdk';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

/**
 * Must stay aligned with the resource names the API derives from routes
 * (apps/api/src/common/authorization/route-permission.util.ts): the first
 * meaningful path segment of each controller. A resource missing here cannot
 * be granted from the UI at all — only via POST /api/v1/roles/:id/permissions.
 */
const RESOURCES = [
  'auth',
  'content',
  'content-types',
  'media',
  'seo',
  'menus',
  'forms',
  'search',
  'trash',
  'users',
  'roles',
  'tokens',
  'agent-tokens',
  'webhooks',
  'plugins',
  'locales',
  'settings',
  'audit',
  'dashboard',
  'mcp',
] as const;

const ACTIONS = [
  'read',
  'create',
  'update',
  'delete',
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
  'install',
  'uninstall',
  'test',
  'validate',
  'import',
  'export',
  'revoke',
  'permanent-delete',
] as const;

type Matrix = Record<string, Record<string, boolean>>;

function permsToMatrix(permissions: Permission[]): Matrix {
  const matrix: Matrix = {};
  for (const r of RESOURCES) {
    matrix[r] = {};
    for (const a of ACTIONS) {
      matrix[r][a] = permissions.some((p) => p.resource === r && p.action === a);
    }
  }
  return matrix;
}

function matrixToBody(matrix: Matrix): AssignPermissionsBody {
  const permissions: Array<{ resource: string; action: string; scope: string }> = [];
  for (const [resource, actions] of Object.entries(matrix)) {
    for (const [action, enabled] of Object.entries(actions)) {
      if (enabled) permissions.push({ resource, action, scope: '*' });
    }
  }
  return { permissions };
}

/** Shared chrome for both header rows and the sticky resource column. */
const HEAD_CELL = 'bg-muted text-2xs font-semibold tracking-wider text-muted-foreground uppercase';

/**
 * i18n keys mirror the resource slug verbatim, hyphens included. (This used to
 * rewrite hyphens to underscores, which never matched the message catalogue,
 * so `content-types` rendered as a raw key.)
 */
function resourceKey(resource: string): string {
  return resource;
}

function countGranted(actions: Record<string, boolean> | undefined): number {
  return ACTIONS.filter((a) => actions?.[a] === true).length;
}

/** The pinned action header; the leading cell also pins to the start edge. */
function MatrixHead(): JSX.Element {
  const t = useTranslations('roles.permissions');

  return (
    <thead>
      <tr>
        <th
          scope="col"
          className={cn(
            HEAD_CELL,
            'sticky start-0 top-0 z-30 h-9 border-b border-e border-border px-3 text-start',
          )}
        >
          Resource
        </th>
        {ACTIONS.map((a) => (
          <th
            key={a}
            scope="col"
            className={cn(
              HEAD_CELL,
              'sticky top-0 z-20 h-9 w-20 border-b border-border px-3 text-center',
            )}
          >
            {t(`actions.${a}`)}
          </th>
        ))}
      </tr>
    </thead>
  );
}

interface MatrixRowProps {
  resource: string;
  actions: Record<string, boolean> | undefined;
  isSystem: boolean;
  /** Every row but the first draws its own top divider. */
  showDivider: boolean;
  onToggle: (resource: string, action: string) => void;
}

function MatrixRow({
  resource,
  actions,
  isSystem,
  showDivider,
  onToggle,
}: MatrixRowProps): JSX.Element {
  const t = useTranslations('roles.permissions');
  const label = t(`resources.${resourceKey(resource)}`);
  const granted = countGranted(actions);
  const dividerTop = showDivider && 'border-t border-border';

  return (
    <tr>
      <th
        scope="row"
        className={cn(
          'sticky start-0 z-10 border-e border-border bg-card px-3 py-2 text-start font-medium',
          dividerTop,
        )}
      >
        <span className="flex items-center gap-3 whitespace-nowrap">
          <span className="text-foreground">{label}</span>
          <span
            className={cn(
              'ms-auto shrink-0 text-2xs font-normal tabular-nums',
              granted === 0 ? 'text-muted-foreground' : 'text-primary',
            )}
          >
            {granted}/{ACTIONS.length}
          </span>
        </span>
      </th>
      {ACTIONS.map((a, actionIndex) => {
        const checked = actions?.[a] ?? false;

        return (
          <td
            key={a}
            className={cn(
              'px-3 py-2 text-center transition-colors duration-150 ease-out-quad',
              actionIndex > 0 && 'border-s border-border',
              dividerTop,
              checked ? 'bg-primary-subtle' : 'bg-card',
              !isSystem && (checked ? 'hover:bg-primary-subtle/70' : 'hover:bg-accent'),
            )}
          >
            <Checkbox
              className="mx-auto"
              checked={checked}
              disabled={isSystem}
              onCheckedChange={() => onToggle(resource, a)}
              aria-label={`${label} — ${t(`actions.${a}`)}`}
            />
          </td>
        );
      })}
    </tr>
  );
}

export interface PermissionMatrixProps {
  roleId: string;
  roleName: string;
  permissions: Permission[];
  isSystem: boolean;
  onSave: (roleId: string, body: AssignPermissionsBody) => Promise<void>;
  onClose: () => void;
}

export function PermissionMatrix({
  roleId,
  roleName,
  permissions,
  isSystem,
  onSave,
  onClose,
}: PermissionMatrixProps): JSX.Element {
  const t = useTranslations('roles.permissions');
  const [matrix, setMatrix] = useState<Matrix>(() => permsToMatrix(permissions));
  const [saving, setSaving] = useState(false);

  const toggle = (resource: string, action: string): void => {
    if (isSystem) return;
    setMatrix((prev) => ({
      ...prev,
      [resource]: { ...prev[resource], [action]: !(prev[resource]?.[action] ?? false) },
    }));
  };

  const handleSave = (): void => {
    void (async (): Promise<void> => {
      setSaving(true);
      try {
        await onSave(roleId, matrixToBody(matrix));
      } finally {
        setSaving(false);
      }
    })();
  };

  const totalCells = RESOURCES.length * ACTIONS.length;
  const totalGranted = RESOURCES.reduce((sum, r) => sum + countGranted(matrix[r]), 0);

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('title', { name: roleName })}</DialogTitle>
        </DialogHeader>

        {isSystem && (
          <Alert variant="info" icon={<Lock className="size-4 translate-y-0.5" />}>
            <AlertDescription>{t('readOnly')}</AlertDescription>
          </Alert>
        )}

        {/* The grid scrolls inside itself so the dialog keeps a stable height, and
            both the action header and the resource column stay pinned while it does. */}
        <div className="max-h-[55vh] overflow-auto rounded-lg border border-border">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <MatrixHead />
            <tbody>
              {RESOURCES.map((r, rowIndex) => (
                <MatrixRow
                  key={r}
                  resource={r}
                  actions={matrix[r]}
                  isSystem={isSystem}
                  showDivider={rowIndex > 0}
                  onToggle={toggle}
                />
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <span className="text-xs text-muted-foreground tabular-nums sm:me-auto">
            {totalGranted}/{totalCells}
          </span>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {!isSystem && (
            <Button onClick={handleSave} loading={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
