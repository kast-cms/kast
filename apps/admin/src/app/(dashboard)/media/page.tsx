import type { Metadata } from 'next';
import type { JSX } from 'react';

export const metadata: Metadata = { title: 'Media' };

export default function MediaPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Media</h2>
        <p className="text-[--color-muted-foreground]">
          Manage uploaded files. Coming in Sprint 4.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-[--color-border] p-12 text-center">
        <p className="text-sm text-[--color-muted-foreground]">No media files yet.</p>
      </div>
    </div>
  );
}
