import { cn } from '@/lib/utils';
import type { HTMLAttributes, JSX, TdHTMLAttributes, ThHTMLAttributes } from 'react';

/**
 * Data table.
 *
 * Wrapped in its own scroll container so a wide table scrolls inside the page
 * instead of pushing the whole layout sideways.
 */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>): JSX.Element {
  return (
    <div className="relative w-full overflow-x-auto">
      <table
        className={cn('w-full caption-bottom border-collapse text-sm tabular-nums', className)}
        {...props}
      />
    </div>
  );
}

/** Sticky by default: the header stays put while long lists scroll. */
export function TableHeader({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  return (
    <thead
      className={cn('sticky top-0 z-10 bg-muted/60 backdrop-blur-sm [&_tr]:border-b', className)}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableFooter({
  className,
  ...props
}: HTMLAttributes<HTMLTableSectionElement>): JSX.Element {
  return (
    <tfoot
      className={cn(
        'border-t border-border bg-muted/50 font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  );
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>): JSX.Element {
  return (
    <tr
      className={cn(
        'border-b border-border transition-colors duration-100',
        'hover:bg-muted/50 data-[state=selected]:bg-primary-subtle/50',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  return (
    <th
      className={cn(
        'h-10 px-4 text-start align-middle text-xs font-semibold tracking-wide text-muted-foreground uppercase',
        'whitespace-nowrap [&:has([role=checkbox])]:w-px [&:has([role=checkbox])]:pe-0',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>): JSX.Element {
  return (
    <td
      className={cn(
        'px-4 py-3 align-middle [&:has([role=checkbox])]:w-px [&:has([role=checkbox])]:pe-0',
        className,
      )}
      {...props}
    />
  );
}

export function TableCaption({
  className,
  ...props
}: HTMLAttributes<HTMLTableCaptionElement>): JSX.Element {
  return <caption className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />;
}
