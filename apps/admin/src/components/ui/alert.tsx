import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ComponentType, HTMLAttributes, JSX, ReactNode } from 'react';

const alertVariants = cva(
  [
    'relative w-full rounded-lg border px-4 py-3 text-sm',
    // Icon-and-text grid: the icon column collapses to nothing when there is
    // no icon, so plain alerts do not carry a phantom indent.
    'grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr]',
  ],
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-card-foreground [&>svg]:text-muted-foreground',
        info: 'border-info/25 bg-info-subtle text-info-subtle-foreground [&>svg]:text-info',
        success:
          'border-success/25 bg-success-subtle text-success-subtle-foreground [&>svg]:text-success',
        warning:
          'border-warning/30 bg-warning-subtle text-warning-subtle-foreground [&>svg]:text-warning',
        destructive:
          'border-destructive/25 bg-destructive-subtle text-destructive-subtle-foreground [&>svg]:text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

/** Default icon per variant, so callers get the right affordance for free. */
const VARIANT_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
};

type AlertProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants> & {
    /** Pass `false` to suppress the automatic variant icon. */
    icon?: ReactNode | false;
  };

export function Alert({ className, variant, icon, children, ...props }: AlertProps): JSX.Element {
  // Variant names are always non-empty strings, so a truthy check covers both
  // `null` and `undefined` without reaching for a loose equality comparison.
  const FallbackIcon = variant ? VARIANT_ICONS[variant] : undefined;

  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {icon === false
        ? null
        : (icon ?? (FallbackIcon ? <FallbackIcon className="size-4 translate-y-0.5" /> : null))}
      {children}
    </div>
  );
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div className={cn('col-start-2 min-h-4 font-medium tracking-tight', className)} {...props} />
  );
}

export function AlertDescription({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn('col-start-2 text-sm opacity-90 [&_p]:leading-relaxed', className)}
      {...props}
    />
  );
}
