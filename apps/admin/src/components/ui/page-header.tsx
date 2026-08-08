import { cn } from '@/lib/utils';
import type { JSX, ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right-hand actions — primary button last, matching platform convention. */
  actions?: ReactNode;
  /** Optional breadcrumb or back-link rendered above the title. */
  breadcrumb?: ReactNode;
  className?: string;
}

/**
 * The standard screen header.
 *
 * Every page previously wrote its own `<h1>` with its own size, weight and
 * spacing; this is the single definition of what a page title looks like.
 */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: PageHeaderProps): JSX.Element {
  return (
    <header className={cn('flex flex-col gap-4', className)}>
      {breadcrumb}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description !== undefined && description !== '' && (
            <p className="max-w-2xl text-sm text-pretty text-muted-foreground">{description}</p>
          )}
        </div>
        {actions !== undefined && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
