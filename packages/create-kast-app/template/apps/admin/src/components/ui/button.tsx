import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, JSX } from 'react';
import { Spinner } from './spinner';

const buttonVariants = cva(
  [
    'relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap',
    'font-medium select-none',
    // Motion is deliberately short — this is a tool, not a landing page.
    'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out-quad',
    // A 1px press translation is enough to feel physical without moving layout.
    'active:translate-y-px',
    'outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
    // Icons inside buttons should never be scaled by the text size utilities.
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover',
        destructive:
          'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive-hover',
        success: 'bg-success text-success-foreground shadow-xs hover:bg-success/90',
        outline:
          'border border-input bg-card text-foreground shadow-2xs hover:border-border-strong hover:bg-muted',
        secondary: 'bg-secondary text-secondary-foreground shadow-2xs hover:bg-secondary-hover',
        subtle: 'bg-primary-subtle text-primary-subtle-foreground hover:bg-primary-subtle/70',
        ghost: 'text-foreground hover:bg-muted hover:text-foreground',
        'ghost-destructive': 'text-destructive hover:bg-destructive-subtle',
        link: 'text-primary underline-offset-4 hover:underline active:translate-y-0',
      },
      size: {
        xs: 'h-7 rounded-sm px-2 text-xs [&_svg:not([class*=size-])]:size-3.5',
        sm: 'h-8 rounded-md px-3 text-sm',
        default: 'h-9 rounded-md px-3.5 text-sm',
        lg: 'h-10 rounded-lg px-5 text-md',
        icon: 'size-9 rounded-md',
        'icon-sm': 'size-8 rounded-md',
        'icon-xs': 'size-7 rounded-sm [&_svg:not([class*=size-])]:size-3.5',
        'icon-lg': 'size-10 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Swaps the leading content for a spinner and disables the button.
   * Ignored when `asChild` is set, since the child owns its own content.
   */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps): JSX.Element {
  const Comp = asChild ? Slot : 'button';

  if (asChild) {
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} {...props}>
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </Comp>
  );
}

export { buttonVariants };
