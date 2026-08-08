'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Hint } from '@/components/ui/tooltip';
import type { RoleSummary } from '@kast-cms/sdk';
import { Plus, Shield, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';
import { CreateRoleDialog } from './create-role-dialog';
import { PermissionMatrix } from './permission-matrix';
import { useRoles } from './use-roles';

function RoleTypeBadge({ isSystem }: { isSystem: boolean }): JSX.Element {
  const t = useTranslations('roles');
  return (
    <Badge variant={isSystem ? 'muted' : 'brand'}>{isSystem ? t('system') : t('custom')}</Badge>
  );
}

/** Placeholder rows so the table keeps its shape while the first page loads. */
function RolesTableSkeleton(): JSX.Element {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-md" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-16 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-8" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-8" />
          </TableCell>
          <TableCell>
            <Skeleton className="ms-auto h-8 w-28" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function RolesPageClient(): JSX.Element {
  const t = useTranslations('roles');
  const tCommon = useTranslations('common');
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

  const isEmpty = lib.roles.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus />
            {t('createRole')}
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.role')}</TableHead>
              <TableHead>{t('table.type')}</TableHead>
              <TableHead className="text-end">{t('table.users')}</TableHead>
              <TableHead className="text-end">{t('table.permissions')}</TableHead>
              <TableHead className="w-44 text-end">
                <span className="sr-only">{t('table.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isEmpty && lib.loading && <RolesTableSkeleton />}
            {isEmpty && !lib.loading && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    Icon={Shield}
                    size="sm"
                    title={t('noRoles')}
                    className="rounded-none border-0"
                    action={
                      <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                        <Plus />
                        {t('createRole')}
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {lib.roles.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-md bg-primary-subtle text-primary-subtle-foreground"
                    >
                      {r.isSystem ? (
                        <ShieldCheck className="size-4" />
                      ) : (
                        <Shield className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{r.displayName}</p>
                      <p className="truncate font-mono text-2xs text-muted-foreground">{r.name}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <RoleTypeBadge isSystem={r.isSystem} />
                </TableCell>
                <TableCell className="text-end text-muted-foreground">{r.usersCount}</TableCell>
                <TableCell className="text-end text-muted-foreground">
                  {r.permissionsCount}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => handleOpenPerms(r)}>
                      <SlidersHorizontal />
                      {t('permissions.viewEdit')}
                    </Button>
                    {!r.isSystem && (
                      <Hint label={tCommon('delete')}>
                        <Button
                          variant="ghost-destructive"
                          size="icon-sm"
                          aria-label={tCommon('delete')}
                          onClick={() => handleDelete(r)}
                        >
                          <Trash2 />
                        </Button>
                      </Hint>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

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
