'use client';

import { AccountSecurity } from '@/components/auth/account-security';
import type { JSX } from 'react';

export default function AccountPage(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Account security</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Protect your sign-in and manage your active devices.
        </p>
      </div>
      <AccountSecurity />
    </div>
  );
}
