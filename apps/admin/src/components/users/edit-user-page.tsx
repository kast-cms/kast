'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { RoleSummary, UpdateUserBody, UserSummary } from '@kast-cms/sdk';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type JSX } from 'react';

interface Props {
  userId: string;
}

type UserStatus = 'active' | 'invited' | 'suspended';

function userStatus(user: UserSummary): UserStatus {
  if (!user.isActive) return 'suspended';
  if (!user.isVerified) return 'invited';
  return 'active';
}

function statusVariant(status: UserStatus): 'success' | 'warning' | 'destructive' {
  if (status === 'active') return 'success';
  if (status === 'invited') return 'warning';
  return 'destructive';
}

/** Holds the form's shape while the user record and role list load. */
function EditUserSkeleton(): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3.5 w-64" />
      </div>
      <Card className="max-w-2xl">
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

interface RoleSelectListProps {
  roles: RoleSummary[];
  selected: string[];
  onToggle: (name: string) => void;
}

function RoleSelectList({ roles, selected, onToggle }: RoleSelectListProps): JSX.Element {
  const t = useTranslations('users.editPage');

  return (
    <div className="space-y-2">
      <Label>{t('roles')}</Label>
      <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {roles.map((r) => (
          <label
            key={r.id}
            className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors duration-150 ease-out-quad hover:bg-muted"
          >
            <Checkbox
              checked={selected.includes(r.name)}
              onCheckedChange={() => onToggle(r.name)}
            />
            <span className="text-sm font-medium text-foreground">{r.displayName}</span>
            <span className="ms-auto font-mono text-2xs text-muted-foreground">{r.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function EditUserPageClient({ userId }: Props): JSX.Element {
  const t = useTranslations('users.editPage');
  const tStatus = useTranslations('users.status');
  const tCommon = useTranslations('common');
  const { session } = useSession();
  const client = createApiClient(session?.accessToken);
  const router = useRouter();

  const [user, setUser] = useState<UserSummary | null>(null);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async (): Promise<void> => {
      const [userRes, rolesRes] = await Promise.all([
        client.users.get(userId),
        client.roles.list(),
      ]);
      const u = userRes.data;
      setUser(u);
      setFirstName(u.firstName ?? '');
      setLastName(u.lastName ?? '');
      setIsActive(u.isActive);
      setSelectedRoles(u.roles);
      setRoles(rolesRes.data);
    })();
  }, [userId]);

  const toggleRole = (name: string): void => {
    setSelectedRoles((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name],
    );
  };

  const handleSave = (): void => {
    void (async (): Promise<void> => {
      setSaving(true);
      try {
        const isSelf = session?.user.id === userId;
        const body: UpdateUserBody = {
          ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
          ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
          roleNames: selectedRoles,
          ...(!isSelf ? { isActive } : {}),
        };
        await client.users.update(userId, body);
        router.push('/users');
      } finally {
        setSaving(false);
      }
    })();
  };

  const isSelf = session?.user.id === userId;

  const backLink = (
    <Link
      href="/users"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-out-quad hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      {t('back')}
    </Link>
  );

  if (!user) {
    return <EditUserSkeleton />;
  }

  const status = userStatus(user);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={backLink}
        title={t('title')}
        description={user.email}
        actions={
          <Badge variant={statusVariant(status)} size="lg" dot>
            {tStatus(status)}
          </Badge>
        }
      />

      <Card className="max-w-2xl">
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-first">{t('firstName')}</Label>
              <Input
                id="edit-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-last">{t('lastName')}</Label>
              <Input
                id="edit-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <RoleSelectList roles={roles} selected={selectedRoles} onToggle={toggleRole} />

          {isSelf ? (
            <Alert variant="info">
              <AlertDescription>{t('cannotSelfSuspend')}</AlertDescription>
            </Alert>
          ) : (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/50 px-4 py-3">
              <Label htmlFor="edit-active" className="cursor-pointer">
                {t('active')}
              </Label>
              <Switch id="edit-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-end">
          <Button variant="outline" asChild>
            <Link href="/users">{tCommon('cancel')}</Link>
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {saving ? t('saving') : t('save')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
