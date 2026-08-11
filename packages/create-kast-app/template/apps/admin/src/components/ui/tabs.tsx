'use client';

import { cn } from '@/lib/utils';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { type ComponentPropsWithoutRef, type JSX } from 'react';

export function Tabs({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Root>): JSX.Element {
  return <TabsPrimitive.Root className={cn('flex flex-col gap-4', className)} {...props} />;
}

type TabsListProps = ComponentPropsWithoutRef<typeof TabsPrimitive.List> & {
  /**
   * `pill` — a segmented control on a muted track. Good for 2–4 peers.
   * `underline` — an underlined bar. Better for many tabs or page-level
   * sections, where a pill track gets visually heavy.
   */
  variant?: 'pill' | 'underline';
};

export function TabsList({ className, variant = 'pill', ...props }: TabsListProps): JSX.Element {
  return (
    <TabsPrimitive.List
      data-variant={variant}
      className={cn(
        'inline-flex items-center',
        variant === 'pill'
          ? 'h-9 w-fit justify-center rounded-lg bg-muted p-1 text-muted-foreground'
          : 'h-10 w-full justify-start gap-1 overflow-x-auto border-b border-border scrollbar-none',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>): JSX.Element {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium',
        'transition-[background-color,color,box-shadow] duration-150 ease-out-quad',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        // Pill
        "[[data-variant='pill']_&]:h-7 [[data-variant='pill']_&]:rounded-md [[data-variant='pill']_&]:px-3",
        "[[data-variant='pill']_&]:text-muted-foreground",
        "[[data-variant='pill']_&]:data-[state=active]:bg-card [[data-variant='pill']_&]:data-[state=active]:text-foreground [[data-variant='pill']_&]:data-[state=active]:shadow-xs",
        // Underline — a -1px offset so the indicator sits on the list's border.
        "[[data-variant='underline']_&]:h-10 [[data-variant='underline']_&]:flex-none [[data-variant='underline']_&]:rounded-none [[data-variant='underline']_&]:px-3",
        "[[data-variant='underline']_&]:border-b-2 [[data-variant='underline']_&]:border-transparent [[data-variant='underline']_&]:-mb-px",
        "[[data-variant='underline']_&]:text-muted-foreground [[data-variant='underline']_&]:hover:text-foreground",
        "[[data-variant='underline']_&]:data-[state=active]:border-primary [[data-variant='underline']_&]:data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Content>): JSX.Element {
  return (
    <TabsPrimitive.Content
      className={cn(
        'flex-1 outline-none data-[state=active]:animate-in data-[state=active]:fade-in-0',
        className,
      )}
      {...props}
    />
  );
}
