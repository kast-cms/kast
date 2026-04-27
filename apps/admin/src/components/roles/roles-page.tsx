'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { RoleSummary } from '@kast/sdk';
import { Plus, Shield, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { CreateRoleDialog } from './create-role-dialog';
import { PermissionMatrix } from './permission-matrix';
import { useRoles } from './use-roles';

function RoleTypeBadge({ isSystem }: { isSystem: boolean }): JSX.Element {
  const t = useTranslations('roles');
  return (
    <Badge variant={isSystem ? 'secondary' : 'outline'}>
      {isSystem ? t('system') : t('custom')}
    </Badge>
  );
}

export function RolesPageClient(): JSX.Element {
  const t = useTranslations('roles');
  const lib = useRoles();
  const [showCreate, setShowCreate] = useState(false);
  const [permRole, setPermRole] = useState<RoleSummary | null>(null);

  const handleOpenPerms = (role: RoleSummary): void => {
    setPermRole(role);
    lib.loadRoleDetail(role.id);
  };

  const handleClosePerms = (): void => {
    setPermRole(null);
    lib.clearSelectedRole();
  };

  const handleDelete = (role: RoleSummary): void => {
    const msg = t('permissions.deleteConfirm', { name: role.displayName });
    if (!window.confirm(msg)) return;
    void lib.deleteRole(role.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-[--color-muted-foreground]">{t('description')}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t('createRole')}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.role')}</TableHead>
            <TableHead>{t('table.type')}</TableHead>
            <TableHead>{t('table.users')}</TableHead>
            <TableHead>{t('table.permissions')}</TableHead>
            <TableHead className="w-36" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lib.roles.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-[--color-muted-foreground]">
                {lib.loading ? '…' : t('noRoles')}
              </TableCell>
            </TableRow>
          )}
          {lib.roles.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-[--color-muted-foreground]" />
                  <div>
                    <p className="font-medium">{r.displayName}</p>
                    <p className="text-xs text-[--color-muted-foreground]">{r.name}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <RoleTypeBadge isSystem={r.isSystem} />
              </TableCell>
              <TableCell>{r.usersCount}</TableCell>
              <TableCell>{r.permissionsCount}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => handleOpenPerms(r)}>
                    {t('permissions.viewEdit')}
                  </Button>
                  {!r.isSystem && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(r)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CreateRoleDialog open={showCreate} onOpenChange={setShowCreate} onCreate={lib.createRole} />

      {permRole !== null && lib.selectedRole !== null && (
        <PermissionMatrix
          roleId={permRole.id}
          roleName={permRole.displayName}
          permissions={lib.selectedRole.permissions}
          isSystem={permRole.isSystem}
          onSave={lib.savePermissions}
          onClose={handleClosePerms}
        />
      )}
    </div>
  );
}
