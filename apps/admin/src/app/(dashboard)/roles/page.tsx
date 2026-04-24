import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Roles' };

export default function RolesPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Roles</h2>
        <p className="text-[--color-muted-foreground]">
          Configure permissions for each role. Coming in Sprint 4.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-[--color-border] p-12 text-center">
        <p className="text-sm text-[--color-muted-foreground]">No roles configured yet.</p>
      </div>
    </div>
  );
}
