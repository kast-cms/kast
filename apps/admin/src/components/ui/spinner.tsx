import { cn } from '@/lib/utils';
import type { JSX } from 'react';

interface SpinnerProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Screen-reader label. Set to `null` when an adjacent element already says it. */
  label?: string | null;
}

const SIZE_MAP = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-8',
  xl: 'size-10',
} as const;

/**
 * Indeterminate spinner.
 *
 * A rotating arc with a round cap rather than the usual two-tone disc — it
 * stays legible at 12 px, where a filled wedge turns into a smudge.
 */
export function Spinner({ className, size = 'md', label = 'Loading' }: SpinnerProps): JSX.Element {
  return (
    <>
      <svg
        data-loading=""
        className={cn('animate-spin text-current', SIZE_MAP[size], className)}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.2" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {label !== null && <span className="sr-only">{label}</span>}
    </>
  );
}

/** Centred spinner for a whole panel or route while it loads. */
export function LoadingBlock({
  className,
  label,
}: {
  className?: string;
  label?: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground',
        className,
      )}
    >
      <Spinner size="lg" label={null} />
      <p className="text-sm">{label ?? 'Loading…'}</p>
    </div>
  );
}
