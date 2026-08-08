'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { getInitials } from '@/lib/utils';
import type { UserSummary } from '@kast-cms/sdk';
import { Pencil, Search, Trash2, UserPlus, Users } from 'lucide-react';
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
  return (
    <Badge variant={variant} dot>
      {t(status)}
    </Badge>
  );
}

function formatLastLogin(date: string | null, never: string): string {
  if (!date) return never;
  return new Date(date).toLocaleDateString();
}

function fullName(user: UserSummary): string {
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
}

/** Placeholder rows so the table keeps its shape while the first page loads. */
function UsersTableSkeleton(): JSX.Element {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <TableRow key={i} className="hover:bg-transparent">
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-44" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-16 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4.5 w-20 rounded-md" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-3.5 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="ms-auto h-7 w-16" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

interface UserRowProps {
  user: UserSummary;
  onTrash: (id: string) => void;
}

function UserRow({ user, onTrash }: UserRowProps): JSX.Element {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const name = fullName(user);

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground">{name !== '' ? name : '—'}</span>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 && <span className="text-muted-foreground">—</span>}
          {user.roles.map((r) => (
            <Badge key={r} variant="muted" size="sm" className="capitalize">
              {r}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge user={user} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatLastLogin(user.lastLoginAt, t('never'))}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Hint label={tCommon('edit')}>
            <Button variant="ghost" size="icon-sm" aria-label={tCommon('edit')} asChild>
              <Link href={`/users/${user.id}`}>
                <Pencil />
              </Link>
            </Button>
          </Hint>
          <Hint label={tCommon('delete')}>
            <Button
              variant="ghost-destructive"
              size="icon-sm"
              aria-label={tCommon('delete')}
              onClick={() => onTrash(user.id)}
            >
              <Trash2 />
            </Button>
          </Hint>
        </div>
      </TableCell>
    </TableRow>
  );
}

const ALL_ROLES = '__all__';

export function UsersPageClient(): JSX.Element {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');
  const lib = useUsers();
  const [showInvite, setShowInvite] = useState(false);

  const handleTrash = (id: string): void => {
    if (!window.confirm('Move this user to trash?')) return;
    void lib.trash(id);
  };

  const isEmpty = lib.filteredUsers.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={() => setShowInvite(true)}>
            <UserPlus />
            {t('invite')}
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="w-full sm:max-w-xs">
            <Input
              placeholder={t('searchPlaceholder')}
              startAdornment={<Search />}
              value={lib.search}
              onChange={(e) => lib.setSearch(e.target.value)}
              aria-label={tCommon('search')}
            />
          </div>
          {/* Radix rejects an empty SelectItem value, so "no filter" travels as a
              sentinel and is mapped back to '' for the query. */}
          <Select
            value={lib.roleFilter || ALL_ROLES}
            onValueChange={(v) => lib.setRoleFilter(v === ALL_ROLES ? '' : v)}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label={t('filterByRole')}>
              <SelectValue placeholder={t('filterByRole')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ROLES}>{t('filterByRole')}</SelectItem>
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
              <TableHead className="w-24 text-end">
                <span className="sr-only">{t('table.actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isEmpty && lib.loading && <UsersTableSkeleton />}
            {isEmpty && !lib.loading && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    Icon={Users}
                    size="sm"
                    title={t('noUsers')}
                    className="rounded-none border-0"
                    action={
                      <Button variant="outline" size="sm" onClick={() => setShowInvite(true)}>
                        <UserPlus />
                        {t('invite')}
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}
            {lib.filteredUsers.map((u) => (
              <UserRow key={u.id} user={u} onTrash={handleTrash} />
            ))}
          </TableBody>
        </Table>
      </Card>

      <InviteUserDialog
        open={showInvite}
        roles={lib.roles}
        onOpenChange={setShowInvite}
        onInvite={lib.invite}
      />
    </div>
  );
}
