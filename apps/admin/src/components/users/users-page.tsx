'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { UserSummary } from '@kast/sdk';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, type JSX } from 'react';
import { InviteUserDialog } from './invite-user-dialog';
import { useUsers } from './use-users';

function getUserStatus(user: UserSummary): 'active' | 'invited' | 'suspended' {
  if (!user.isActive) return 'suspended';
  if (!user.isVerified) return 'invited';
  return 'active';
}

function StatusBadge({ user }: { user: UserSummary }): JSX.Element {
  const t = useTranslations('users.status');
  const status = getUserStatus(user);
  const variant =
    status === 'active' ? 'success' : status === 'invited' ? 'warning' : 'destructive';
  return <Badge variant={variant}>{t(status)}</Badge>;
}

function formatLastLogin(date: string | null, never: string): string {
  if (!date) return never;
  return new Date(date).toLocaleDateString();
}

export function UsersPageClient(): JSX.Element {
  const t = useTranslations('users');
  const lib = useUsers();
  const [showInvite, setShowInvite] = useState(false);

  const handleTrash = (id: string): void => {
    if (!window.confirm('Move this user to trash?')) return;
    void lib.trash(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-[--color-muted-foreground]">{t('description')}</p>
        </div>
        <Button onClick={() => setShowInvite(true)}>
          <UserPlus className="me-2 h-4 w-4" />
          {t('invite')}
        </Button>
      </div>

      <div className="flex gap-3">
        <Input
          className="max-w-xs"
          placeholder={t('searchPlaceholder')}
          value={lib.search}
          onChange={(e) => lib.setSearch(e.target.value)}
        />
        <Select value={lib.roleFilter} onValueChange={lib.setRoleFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('filterByRole')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('filterByRole')}</SelectItem>
            {lib.roles.map((r) => (
              <SelectItem key={r.id} value={r.name}>
                {r.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('table.name')}</TableHead>
            <TableHead>{t('table.email')}</TableHead>
            <TableHead>{t('table.roles')}</TableHead>
            <TableHead>{t('table.status')}</TableHead>
            <TableHead>{t('table.lastLogin')}</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {lib.filteredUsers.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-10 text-center text-[--color-muted-foreground]">
                {lib.loading ? '…' : t('noUsers')}
              </TableCell>
            </TableRow>
          )}
          {lib.filteredUsers.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">
                {u.firstName || u.lastName
                  ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
                  : '—'}
              </TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {u.roles.map((r) => (
                    <Badge key={r} variant="outline" className="text-xs capitalize">
                      {r}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge user={u} />
              </TableCell>
              <TableCell className="text-sm text-[--color-muted-foreground]">
                {formatLastLogin(u.lastLoginAt, t('never'))}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/users/${u.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleTrash(u.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <InviteUserDialog
        open={showInvite}
        roles={lib.roles}
        onOpenChange={setShowInvite}
        onInvite={lib.invite}
      />
    </div>
  );
}
