'use client';

import { cn } from '@/lib/utils';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import type { ComponentProps, JSX } from 'react';

export const ToastProvider = ToastPrimitive.Provider;

export function ToastViewport({
  className,
  ...props
}: ToastPrimitive.ToastViewportProps): JSX.Element {
  return (
    <ToastPrimitive.Viewport
      className={cn(
        'fixed bottom-0 end-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-sm',
        className,
      )}
      {...props}
    />
  );
}

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-md border p-4 shadow-lg transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default: 'border-[--color-border] bg-[--color-background] text-[--color-foreground]',
        success:
          'border-[--color-border] bg-[--color-background] text-[--color-foreground] [&_[data-toast-accent]]:bg-emerald-500',
        destructive:
          'border-[--color-destructive] bg-[--color-background] text-[--color-foreground] [&_[data-toast-accent]]:bg-[--color-destructive]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface ToastProps extends ToastPrimitive.ToastProps, VariantProps<typeof toastVariants> {}

export function Toast({ className, variant, children, ...props }: ToastProps): JSX.Element {
  return (
    <ToastPrimitive.Root className={cn(toastVariants({ variant }), className)} {...props}>
      <span data-toast-accent className="absolute inset-y-0 start-0 w-1" aria-hidden="true" />
      <div className="flex-1 ps-2">{children}</div>
      <ToastPrimitive.Close
        className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[--color-ring]"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export function ToastTitle({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Title>): JSX.Element {
  return <ToastPrimitive.Title className={cn('text-sm font-semibold', className)} {...props} />;
}

export function ToastDescription({
  className,
  ...props
}: ComponentProps<typeof ToastPrimitive.Description>): JSX.Element {
  return (
    <ToastPrimitive.Description
      className={cn('mt-1 text-sm text-[--color-muted-foreground]', className)}
      {...props}
    />
  );
}
