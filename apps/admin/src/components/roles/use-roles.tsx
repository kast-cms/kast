'use client';

import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { AssignPermissionsBody, CreateRoleBody, RoleDetail, RoleSummary } from '@kast-cms/sdk';
import { useCallback, useEffect, useState } from 'react';

export interface UseRolesReturn {
  roles: RoleSummary[];
  selectedRole: RoleDetail | null;
  loading: boolean;
  loadingDetail: boolean;
  loadRoleDetail: (id: string) => void;
  clearSelectedRole: () => void;
  createRole: (body: CreateRoleBody) => Promise<void>;
  deleteRole: (id: string) => Promise<void>;
  savePermissions: (roleId: string, body: AssignPermissionsBody) => Promise<void>;
}

export function useRoles(): UseRolesReturn {
  const { session } = useSession();
  const client = createApiClient(session?.accessToken);

  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadRoles = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await client.roles.list();
      setRoles(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const loadRoleDetail = useCallback((id: string): void => {
    void (async (): Promise<void> => {
      setLoadingDetail(true);
      try {
        const res = await client.roles.get(id);
        setSelectedRole(res.data);
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, []);

  const clearSelectedRole = useCallback((): void => {
    setSelectedRole(null);
  }, []);

  const createRole = useCallback(
    async (body: CreateRoleBody): Promise<void> => {
      await client.roles.create(body);
      void loadRoles();
    },
    [loadRoles],
  );

  const deleteRole = useCallback(
    async (id: string): Promise<void> => {
      await client.roles.delete(id);
      void loadRoles();
    },
    [loadRoles],
  );

  const savePermissions = useCallback(
    async (roleId: string, body: AssignPermissionsBody): Promise<void> => {
      const res = await client.roles.assignPermissions(roleId, body);
      setSelectedRole(res.data);
      void loadRoles();
    },
    [loadRoles],
  );

  return {
    roles,
    selectedRole,
    loading,
    loadingDetail,
    loadRoleDetail,
    clearSelectedRole,
    createRole,
    deleteRole,
    savePermissions,
  };
}
