import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, JSX } from 'react';

const cardVariants = cva('rounded-xl bg-card text-card-foreground', {
  variants: {
    variant: {
      /** The default surface: a hairline border and a whisper of elevation. */
      default: 'border border-border shadow-xs',
      /** Lifted — for things that float above the page, like summary panels. */
      elevated: 'border border-border shadow-md',
      /** Flat — inside another card, or when the parent already draws a border. */
      flat: 'border border-border',
      /** Dashed — a drop target or a "nothing here yet" placeholder. */
      dashed: 'border border-dashed border-border-strong bg-transparent',
    },
    interactive: {
      true: 'cursor-pointer transition-[border-color,box-shadow,transform] duration-150 ease-out-quad hover:-translate-y-px hover:border-border-strong hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
      false: '',
    },
  },
  defaultVariants: { variant: 'default', interactive: false },
});

type CardProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>;

export function Card({ className, variant, interactive, ...props }: CardProps): JSX.Element {
  return <div className={cn(cardVariants({ variant, interactive }), className)} {...props} />;
}

/**
 * Header row. Uses a two-column grid so `<CardAction>` can sit flush right
 * without the title text wrapping underneath it.
 */
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        'grid auto-rows-min grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 px-5 pt-5',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <h3
      className={cn('text-md leading-tight font-semibold tracking-tight', className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <p className={cn('col-start-1 text-sm text-muted-foreground', className)} {...props} />;
}

/** Right-aligned slot in the header — buttons, menus, badges. */
export function CardAction({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        'col-start-2 row-span-2 row-start-1 flex items-center gap-2 self-start',
        className,
      )}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('px-5 py-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn('flex items-center gap-2 border-t border-border px-5 py-3.5', className)}
      {...props}
    />
  );
}
