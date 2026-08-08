'use client';

import { cn } from '@/lib/utils';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';
import type { ComponentPropsWithoutRef, JSX } from 'react';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

/** Shared surface styling for the menu popup and its submenus. */
const surfaceClasses = cn(
  'z-50 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg',
  'origin-(--radix-dropdown-menu-content-transform-origin)',
  'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
  'data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
  'data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1',
);

/** Shared row styling for items, checkbox items and radio items. */
const itemClasses = cn(
  'relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none',
  'transition-colors duration-100',
  'focus:bg-accent focus:text-accent-foreground',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg]:text-muted-foreground",
  'focus:[&_svg]:text-current',
);

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>): JSX.Element {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          surfaceClasses,
          'max-h-(--radix-dropdown-menu-content-available-height)',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

type ItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: 'default' | 'destructive';
};

export function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: ItemProps): JSX.Element {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        itemClasses,
        inset === true && 'ps-8',
        variant === 'destructive' &&
          'text-destructive focus:bg-destructive-subtle focus:text-destructive-subtle-foreground [&_svg]:text-destructive',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>): JSX.Element {
  return (
    <DropdownMenuPrimitive.CheckboxItem className={cn(itemClasses, 'ps-8', className)} {...props}>
      <span className="absolute start-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>): JSX.Element {
  return (
    <DropdownMenuPrimitive.RadioItem className={cn(itemClasses, 'ps-8', className)} {...props}>
      <span className="absolute start-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

export function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger>): JSX.Element {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(itemClasses, 'data-[state=open]:bg-accent', className)}
      {...props}
    >
      {children}
      <ChevronRight className="ms-auto size-4 rtl:rotate-180" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>): JSX.Element {
  return <DropdownMenuPrimitive.SubContent className={cn(surfaceClasses, className)} {...props} />;
}

type LabelProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
};

export function DropdownMenuLabel({ className, inset, ...props }: LabelProps): JSX.Element {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        'px-2 py-1.5 text-2xs font-semibold tracking-wider text-muted-foreground uppercase',
        inset === true && 'ps-8',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>): JSX.Element {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

/** Right-aligned shortcut hint inside a menu item. */
export function DropdownMenuShortcut({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>): JSX.Element {
  return (
    <span
      className={cn('ms-auto text-2xs tracking-widest text-muted-foreground', className)}
      {...props}
    />
  );
}
