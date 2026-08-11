'use client';

import { useToast } from '@/components/ui/use-toast';
import { useApiClient } from '@/lib/session';
import type { InviteUserBody, RoleSummary, UpdateUserBody, UserSummary } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';

export interface UseUsersReturn {
  users: UserSummary[];
  filteredUsers: UserSummary[];
  roles: RoleSummary[];
  loading: boolean;
  search: string;
  roleFilter: string;
  setSearch: (v: string) => void;
  setRoleFilter: (v: string) => void;
  invite: (body: InviteUserBody) => Promise<void>;
  resendInvite: (id: string) => Promise<void>;
  revokeInvite: (id: string) => Promise<void>;
  update: (id: string, body: UpdateUserBody) => Promise<void>;
  trash: (id: string) => Promise<void>;
}

export function useUsers(): UseUsersReturn {
  const client = useApiClient();
  const { toast } = useToast();
  const t = useTranslations('users');

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const reportError = useCallback(
    (err: unknown): void => {
      toast({
        variant: 'destructive',
        title: t('errorTitle'),
        description: err instanceof Error ? err.message : t('loadError'),
      });
    },
    [toast, t],
  );

  const loadUsers = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await client.users.list(roleFilter ? { role: roleFilter } : {});
      setUsers(res.data);
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, reportError, client]);

  const loadRoles = useCallback(async (): Promise<void> => {
    try {
      const res = await client.roles.list();
      setRoles(res.data);
    } catch (err) {
      reportError(err);
    }
  }, [reportError, client]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const invite = useCallback(
    async (body: InviteUserBody): Promise<void> => {
      try {
        await client.users.invite(body);
        void loadUsers();
      } catch (err) {
        reportError(err);
        throw err;
      }
    },
    [loadUsers, reportError, client],
  );

  const update = useCallback(
    async (id: string, body: UpdateUserBody): Promise<void> => {
      try {
        await client.users.update(id, body);
        void loadUsers();
      } catch (err) {
        reportError(err);
        throw err;
      }
    },
    [loadUsers, reportError, client],
  );

  const resendInvite = useCallback(
    async (id: string): Promise<void> => {
      try {
        await client.users.resendInvite(id);
        toast({ title: t('inviteResent') });
      } catch (err) {
        reportError(err);
      }
    },
    [client, reportError, toast, t],
  );

  const revokeInvite = useCallback(
    async (id: string): Promise<void> => {
      try {
        await client.users.revokeInvite(id);
        toast({ title: t('inviteRevoked') });
        void loadUsers();
      } catch (err) {
        reportError(err);
      }
    },
    [client, loadUsers, reportError, toast, t],
  );

  const trash = useCallback(
    async (id: string): Promise<void> => {
      try {
        await client.users.trash(id);
        setUsers((prev) => prev.filter((u) => u.id !== id));
      } catch (err) {
        reportError(err);
      }
    },
    [reportError, client],
  );

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase();
    return u.email.toLowerCase().includes(q) || name.includes(q);
  });

  return {
    users,
    filteredUsers,
    roles,
    loading,
    search,
    roleFilter,
    setSearch,
    setRoleFilter,
    invite,
    resendInvite,
    revokeInvite,
    update,
    trash,
  };
}
