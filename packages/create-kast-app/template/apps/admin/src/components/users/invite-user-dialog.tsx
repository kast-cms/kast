'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { InviteUserBody, RoleSummary } from '@kast-cms/sdk';
import { Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

interface Props {
  open: boolean;
  roles: RoleSummary[];
  onOpenChange: (open: boolean) => void;
  onInvite: (body: InviteUserBody) => Promise<void>;
}

export function InviteUserDialog({ open, roles, onOpenChange, onInvite }: Props): JSX.Element {
  const t = useTranslations('users.inviteDialog');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleRole = (name: string): void => {
    setSelectedRoles((prev) =>
      prev.includes(name) ? prev.filter((r) => r !== name) : [...prev, name],
    );
  };

  const handleSubmit = (): void => {
    void (async (): Promise<void> => {
      setSubmitting(true);
      try {
        const body: InviteUserBody = {
          email,
          roleNames: selectedRoles,
          ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
          ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        };
        await onInvite(body);
        setEmail('');
        setFirstName('');
        setLastName('');
        setSelectedRoles([]);
        onOpenChange(false);
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email" required>
              {t('email')}
            </Label>
            <Input
              id="invite-email"
              type="email"
              startAdornment={<Mail />}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-first">{t('firstName')}</Label>
              <Input
                id="invite-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-last">{t('lastName')}</Label>
              <Input
                id="invite-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('roles')}</Label>
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {roles.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors duration-150 ease-out-quad hover:bg-muted"
                >
                  <Checkbox
                    checked={selectedRoles.includes(r.name)}
                    onCheckedChange={() => toggleRole(r.name)}
                  />
                  <span className="text-sm font-medium text-foreground">{r.displayName}</span>
                  <span className="ms-auto font-mono text-2xs text-muted-foreground">{r.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!email} loading={submitting}>
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
