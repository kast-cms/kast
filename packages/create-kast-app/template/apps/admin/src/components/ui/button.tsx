import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, JSX } from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-ring] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[--color-primary] text-[--color-primary-foreground] hover:bg-[--color-primary]/90',
        destructive:
          'bg-[--color-destructive] text-[--color-destructive-foreground] hover:bg-[--color-destructive]/90',
        outline:
          'border border-[--color-border] bg-[--color-background] text-[--color-foreground] hover:bg-[--color-accent] hover:text-[--color-accent-foreground]',
        secondary:
          'bg-[--color-secondary] text-[--color-secondary-foreground] hover:bg-[--color-secondary]/80',
        ghost: 'hover:bg-[--color-accent] hover:text-[--color-accent-foreground]',
        link: 'text-[--color-primary] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
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
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps): JSX.Element {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
