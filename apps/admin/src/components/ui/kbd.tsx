import { cn } from '@/lib/utils';
import type { HTMLAttributes, JSX } from 'react';

/** A single keycap. Use one per key: `<Kbd>⌘</Kbd><Kbd>K</Kbd>`. */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>): JSX.Element {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border',
        'bg-muted px-1.5 font-sans text-2xs font-medium text-muted-foreground',
        'shadow-[inset_0_-1px_0_0_var(--color-border)] select-none',
        className,
      )}
      {...props}
    />
  );
}
