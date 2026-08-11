'use client';

import { cn } from '@/lib/utils';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { ComponentProps, ComponentType, JSX } from 'react';

export const ToastProvider = ToastPrimitive.Provider;

export function ToastViewport({
  className,
  ...props
}: ToastPrimitive.ToastViewportProps): JSX.Element {
  return (
    <ToastPrimitive.Viewport
      className={cn(
        'fixed bottom-0 end-0 z-100 flex max-h-screen w-full flex-col-reverse gap-2 p-4 outline-none sm:max-w-sm',
        className,
      )}
      {...props}
    />
  );
}

const toastVariants = cva(
  [
    'group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden',
    'rounded-lg border bg-popover p-4 pe-10 text-popover-foreground shadow-lg',
    'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 data-[state=open]:fade-in-0',
    'data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-4',
    'data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=move]:transition-none',
    'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:animate-out data-[swipe=end]:fade-out-0',
  ],
  {
    variants: {
      variant: {
        default: 'border-border [&_[data-toast-icon]]:text-muted-foreground',
        success: 'border-success/30 [&_[data-toast-icon]]:text-success',
        destructive: 'border-destructive/30 [&_[data-toast-icon]]:text-destructive',
        warning: 'border-warning/30 [&_[data-toast-icon]]:text-warning',
        info: 'border-info/30 [&_[data-toast-icon]]:text-info',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

const TOAST_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  destructive: XCircle,
  warning: AlertTriangle,
  info: Info,
};

interface ToastProps extends ToastPrimitive.ToastProps, VariantProps<typeof toastVariants> {}

export function Toast({ className, variant, children, ...props }: ToastProps): JSX.Element {
  // Variant names are always non-empty strings, so a truthy check covers both
  // `null` and `undefined` without reaching for a loose equality comparison.
  const Icon = variant ? TOAST_ICONS[variant] : undefined;

  return (
    <ToastPrimitive.Root className={cn(toastVariants({ variant }), className)} {...props}>
      {Icon && <Icon data-toast-icon className="mt-px size-4.5 shrink-0" />}
      <div className="flex-1 space-y-1">{children}</div>
      <ToastPrimitive.Close
        className={cn(
          'absolute end-3 top-3 grid size-6 place-items-center rounded-md text-muted-foreground',
          'transition-colors hover:bg-muted hover:text-foreground',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
        )}
        aria-label="Close"
      >
        <X className="size-3.5" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export function ToastTitle({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Title>): JSX.Element {
  return (
    <ToastPrimitive.Title
      className={cn('text-sm leading-tight font-semibold', className)}
      {...props}
    />
  );
}

export function ToastDescription({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Description>): JSX.Element {
  return (
    <ToastPrimitive.Description
      className={cn('text-sm text-pretty text-muted-foreground', className)}
      {...props}
    />
  );
}

export function ToastAction({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Action>): JSX.Element {
  return (
    <ToastPrimitive.Action
      className={cn(
        'mt-1 inline-flex h-7 items-center rounded-md border border-border px-2.5 text-xs font-medium',
        'transition-colors hover:bg-muted',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring/70',
        className,
      )}
      {...props}
    />
  );
}
