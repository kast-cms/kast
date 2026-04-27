'use client';
import type { JSX } from 'react';

import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

interface TopbarProps {
  title?: string;
}

export function Topbar({ title }: TopbarProps): JSX.Element {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[--color-border] bg-[--color-background] px-6">
      <div className="flex items-center gap-4">
        {title && <h1 className="text-base font-semibold text-[--color-foreground]">{title}</h1>}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
