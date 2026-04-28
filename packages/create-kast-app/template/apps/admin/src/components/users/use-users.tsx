'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { InviteUserBody, RoleSummary, UpdateUserBody, UserSummary } from '@kast-cms/sdk';
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
  update: (id: string, body: UpdateUserBody) => Promise<void>;
  trash: (id: string) => Promise<void>;
}

export function useUsers(): UseUsersReturn {
  const { session } = useSession();
  const client = createApiClient(session?.accessToken);

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  const loadUsers = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await client.users.list(roleFilter ? { role: roleFilter } : {});
      setUsers(res.data);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  const loadRoles = useCallback(async (): Promise<void> => {
    const res = await client.roles.list();
    setRoles(res.data);
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const invite = useCallback(
    async (body: InviteUserBody): Promise<void> => {
      await client.users.invite(body);
      void loadUsers();
    },
    [loadUsers],
  );

  const update = useCallback(
    async (id: string, body: UpdateUserBody): Promise<void> => {
      await client.users.update(id, body);
      void loadUsers();
    },
    [loadUsers],
  );

  const trash = useCallback(async (id: string): Promise<void> => {
    await client.users.trash(id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

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
    update,
    trash,
  };
}
