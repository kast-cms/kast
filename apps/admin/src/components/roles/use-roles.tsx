'use client';

import { useToast } from '@/components/ui/use-toast';
import { useApiClient } from '@/lib/session';
import type { AssignPermissionsBody, CreateRoleBody, RoleDetail, RoleSummary } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
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
  const client = useApiClient();
  const { toast } = useToast();
  const t = useTranslations('roles');

  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [selectedRole, setSelectedRole] = useState<RoleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

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

  const loadRoles = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await client.roles.list();
      setRoles(res.data);
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  }, [reportError, client]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const loadRoleDetail = useCallback(
    (id: string): void => {
      void (async (): Promise<void> => {
        setLoadingDetail(true);
        try {
          const res = await client.roles.get(id);
          setSelectedRole(res.data);
        } catch (err) {
          reportError(err);
        } finally {
          setLoadingDetail(false);
        }
      })();
    },
    [reportError, client],
  );

  const clearSelectedRole = useCallback((): void => {
    setSelectedRole(null);
  }, []);

  const createRole = useCallback(
    async (body: CreateRoleBody): Promise<void> => {
      try {
        await client.roles.create(body);
        void loadRoles();
      } catch (err) {
        reportError(err);
        throw err;
      }
    },
    [loadRoles, reportError, client],
  );

  const deleteRole = useCallback(
    async (id: string): Promise<void> => {
      try {
        await client.roles.delete(id);
        void loadRoles();
      } catch (err) {
        reportError(err);
      }
    },
    [loadRoles, reportError, client],
  );

  const savePermissions = useCallback(
    async (roleId: string, body: AssignPermissionsBody): Promise<void> => {
      try {
        const res = await client.roles.assignPermissions(roleId, body);
        setSelectedRole(res.data);
        void loadRoles();
      } catch (err) {
        reportError(err);
        throw err;
      }
    },
    [loadRoles, reportError, client],
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
