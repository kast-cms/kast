import { cn } from '@/lib/utils';
import type { HTMLAttributes, JSX } from 'react';

/**
 * Loading placeholder.
 *
 * Uses a travelling sheen rather than a pulse: a pulse reads as "something is
 * blinking at me", a sheen reads as "content is on its way". Falls back to a
 * plain block under `prefers-reduced-motion` via the global base rule.
 */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer',
        'after:bg-gradient-to-r after:from-transparent after:via-foreground/[0.06] after:to-transparent',
        className,
      )}
      {...props}
    />
  );
}

/** Convenience: N stacked lines of text, with a short last line. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/5' : 'w-full')} />
      ))}
    </div>
  );
}
