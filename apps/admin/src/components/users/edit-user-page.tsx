'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { RoleSummary, UpdateUserBody, UserSummary } from '@kast/sdk';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type JSX } from 'react';

interface Props {
  userId: string;
}

export function EditUserPageClient({ userId }: Props): JSX.Element {
  const t = useTranslations('users.editPage');
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

  if (!user) {
    return (
      <div className="flex h-32 items-center justify-center text-[--color-muted-foreground]">…</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-[--color-muted-foreground]">{user.email}</p>
        </div>
      </div>

      <div className="max-w-lg space-y-5">
        <div className="grid grid-cols-2 gap-4">
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
            <Input id="edit-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('roles')}</Label>
          <div className="space-y-2 rounded-md border border-[--color-border] p-3">
            {roles.map((r) => (
              <label key={r.id} className="flex cursor-pointer items-center gap-2">
                <Checkbox
                  checked={selectedRoles.includes(r.name)}
                  onCheckedChange={() => toggleRole(r.name)}
                />
                <span className="text-sm">{r.displayName}</span>
              </label>
            ))}
          </div>
        </div>

        {!isSelf && (
          <div className="flex items-center justify-between rounded-md border border-[--color-border] p-4">
            <div>
              <p className="text-sm font-medium">{t('active')}</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        )}

        <Button onClick={handleSave} disabled={saving}>
          {saving ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
}
