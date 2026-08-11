import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { JSX } from 'react';

const indicatorVariants = cva('h-full rounded-full transition-[width] duration-500 ease-spring', {
  variants: {
    tone: {
      default: 'bg-primary',
      success: 'bg-success',
      warning: 'bg-warning',
      destructive: 'bg-destructive',
      info: 'bg-info',
    },
  },
  defaultVariants: { tone: 'default' },
});

interface ProgressProps extends VariantProps<typeof indicatorVariants> {
  /** Current value, clamped into `[0, max]`. */
  value: number;
  max?: number;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  label?: string;
}

const TRACK_HEIGHT = { sm: 'h-1', default: 'h-1.5', lg: 'h-2.5' } as const;

/**
 * Determinate progress bar. Hand-rolled rather than pulling in another Radix
 * package — it is a div with a width, and the ARIA contract is four attributes.
 */
export function Progress({
  value,
  max = 100,
  tone,
  size = 'default',
  className,
  label,
}: ProgressProps): JSX.Element {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = (clamped / safeMax) * 100;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-label={label}
      className={cn('w-full overflow-hidden rounded-full bg-muted', TRACK_HEIGHT[size], className)}
    >
      <div className={cn(indicatorVariants({ tone }))} style={{ width: `${percent}%` }} />
    </div>
  );
}
