import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Trash' };

export default function TrashPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Trash</h2>
        <p className="text-[--color-muted-foreground]">
          Recover or permanently delete soft-deleted content. Coming soon.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-[--color-border] p-12 text-center">
        <p className="text-sm text-[--color-muted-foreground]">Trash is empty.</p>
      </div>
    </div>
  );
}
