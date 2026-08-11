'use client';

import { cn } from '@/lib/utils';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import type { HTMLAttributes, JSX } from 'react';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;
export const SheetPortal = SheetPrimitive.Portal;

export function SheetOverlay({
  className,
  ...props
}: SheetPrimitive.DialogOverlayProps): JSX.Element {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className,
      )}
      {...props}
    />
  );
}

const sheetVariants = cva(
  [
    'fixed z-50 flex flex-col gap-0 bg-card text-card-foreground shadow-xl',
    'transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out',
    'data-[state=closed]:duration-200 data-[state=open]:duration-300',
  ],
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 max-h-[80vh] border-b border-border data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom:
          'inset-x-0 bottom-0 max-h-[80vh] border-t border-border data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        left: 'inset-y-0 start-0 h-full w-3/4 border-e border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-md rtl:data-[state=closed]:slide-out-to-right rtl:data-[state=open]:slide-in-from-right',
        right:
          'inset-y-0 end-0 h-full w-3/4 border-s border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-md rtl:data-[state=closed]:slide-out-to-left rtl:data-[state=open]:slide-in-from-left',
      },
    },
    defaultVariants: { side: 'right' },
  },
);

interface SheetContentProps
  extends SheetPrimitive.DialogContentProps, VariantProps<typeof sheetVariants> {}

export function SheetContent({
  side = 'right',
  className,
  children,
  ...props
}: SheetContentProps): JSX.Element {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        <SheetPrimitive.Close
          className={cn(
            'absolute end-4 top-4 grid size-7 place-items-center rounded-md text-muted-foreground',
            'transition-colors hover:bg-muted hover:text-foreground',
            'outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-card',
          )}
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

/** Fixed header. Pair with `<SheetBody>` so only the middle section scrolls. */
export function SheetHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-y-1 border-b border-border px-6 py-4 pe-12 text-start',
        className,
      )}
      {...props}
    />
  );
}

/** The scrollable middle of a sheet. */
export function SheetBody({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('flex-1 overflow-y-auto px-6 py-5', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return (
    <div
      className={cn(
        'mt-auto flex shrink-0 flex-col-reverse gap-2 border-t border-border px-6 py-4',
        'sm:flex-row sm:items-center sm:justify-end',
        className,
      )}
      {...props}
    />
  );
}

export function SheetTitle({ className, ...props }: SheetPrimitive.DialogTitleProps): JSX.Element {
  return (
    <SheetPrimitive.Title
      className={cn('text-md font-semibold tracking-tight text-foreground', className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: SheetPrimitive.DialogDescriptionProps): JSX.Element {
  return (
    <SheetPrimitive.Description
      className={cn('text-sm text-pretty text-muted-foreground', className)}
      {...props}
    />
  );
}
