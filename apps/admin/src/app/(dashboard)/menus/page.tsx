import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Menus' };

export default function MenusPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Menus</h2>
        <p className="text-[--color-muted-foreground]">
          Build navigation menus for your frontend. Coming in Sprint 9.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-[--color-border] p-12 text-center">
        <p className="text-sm text-[--color-muted-foreground]">No menus yet.</p>
      </div>
    </div>
  );
}
