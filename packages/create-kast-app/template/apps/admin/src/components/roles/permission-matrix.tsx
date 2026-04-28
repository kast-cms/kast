'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { AssignPermissionsBody, Permission } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

const RESOURCES = ['content', 'media', 'seo', 'content-types', 'users', 'roles', 'tokens'] as const;

const ACTIONS = ['read', 'create', 'update', 'delete', 'publish'] as const;

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

  const resourceKey = (r: string): string => r.replace('-', '_');

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title', { name: roleName })}</DialogTitle>
        </DialogHeader>

        {isSystem && <p className="text-sm text-[--color-muted-foreground]">{t('readOnly')}</p>}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="py-2 text-start font-medium">Resource</th>
                {ACTIONS.map((a) => (
                  <th key={a} className="px-3 py-2 text-center font-medium">
                    {t(`actions.${a}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map((r) => (
                <tr key={r} className="border-t border-[--color-border]">
                  <td className="py-2 font-medium">{t(`resources.${resourceKey(r)}`)}</td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="px-3 py-2 text-center">
                      <Checkbox
                        checked={matrix[r]?.[a] ?? false}
                        disabled={isSystem}
                        onCheckedChange={() => toggle(r, a)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {!isSystem && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
