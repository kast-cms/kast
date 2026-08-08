import { cn } from '@/lib/utils';
import type { JSX } from 'react';

/**
 * The Kast mark: a "K" whose counter is formed by the two exchange arrows from
 * the wordmark, drawn in currentColor so it inherits the surface it sits on.
 */
export function KastLogo({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn('size-7', className)}
      role="img"
      aria-label="Kast"
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M8.5 8.5v15"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        className="text-primary-foreground"
      />
      <path
        d="M13 15h9m0 0-3-3m3 3-3 3"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary-foreground"
      />
      <path
        d="M22 21h-9m0 0 3-3m-3 3 3 3"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary-foreground/70"
      />
    </svg>
  );
}
