import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, JSX } from 'react';

const badgeVariants = cva(
  [
    'inline-flex w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap',
    'border font-medium transition-colors duration-150',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3",
  ],
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border bg-transparent text-foreground',
        // Tinted variants read as status without shouting; the solid ones above
        // are for counts and primary emphasis.
        brand: 'border-transparent bg-primary-subtle text-primary-subtle-foreground',
        success: 'border-transparent bg-success-subtle text-success-subtle-foreground',
        warning: 'border-transparent bg-warning-subtle text-warning-subtle-foreground',
        destructive: 'border-transparent bg-destructive-subtle text-destructive-subtle-foreground',
        info: 'border-transparent bg-info-subtle text-info-subtle-foreground',
        muted: 'border-transparent bg-muted text-muted-foreground',
      },
      size: {
        sm: 'h-5 rounded-sm px-1.5 text-2xs',
        default: 'h-[1.375rem] rounded-md px-2 text-xs',
        lg: 'h-6 rounded-md px-2.5 text-xs',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants> & {
    /** Renders a leading status dot tinted to the current variant. */
    dot?: boolean;
  };

export function Badge({
  className,
  variant,
  size,
  dot,
  children,
  ...props
}: BadgeProps): JSX.Element {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot === true && (
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current opacity-70" />
      )}
      {children}
    </span>
  );
}

export { badgeVariants };
