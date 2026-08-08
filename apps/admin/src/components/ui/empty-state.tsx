import { cn } from '@/lib/utils';
import type { ComponentType, JSX, ReactNode } from 'react';

interface EmptyStateProps {
  Icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  /** Primary and secondary actions — usually one or two `<Button>`s. */
  action?: ReactNode;
  className?: string;
  /** `sm` for empties inside a card or panel; `default` for a whole page. */
  size?: 'sm' | 'default';
}

/**
 * The "nothing here yet" state.
 *
 * Every list screen used to hand-roll this, which is why they all looked
 * slightly different. One component, one layout, one voice.
 */
export function EmptyState({
  Icon,
  title,
  description,
  action,
  className,
  size = 'default',
}: EmptyStateProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border text-center',
        size === 'default' ? 'gap-3 px-6 py-16' : 'gap-2 px-4 py-10',
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            'grid place-items-center rounded-xl bg-muted text-muted-foreground',
            size === 'default' ? 'mb-1 size-12 [&_svg]:size-6' : 'size-9 [&_svg]:size-4.5',
          )}
        >
          <Icon />
        </div>
      )}
      <h3
        className={cn('font-semibold text-foreground', size === 'default' ? 'text-md' : 'text-sm')}
      >
        {title}
      </h3>
      {description !== undefined && description !== '' && (
        <p className="max-w-sm text-sm text-balance text-muted-foreground">{description}</p>
      )}
      {action !== undefined && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </div>
  );
}
