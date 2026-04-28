'use client';

import { cn } from '@/lib/utils';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { type ComponentPropsWithoutRef, type JSX } from 'react';

export function Tabs(props: ComponentPropsWithoutRef<typeof TabsPrimitive.Root>): JSX.Element {
  return <TabsPrimitive.Root {...props} />;
}

export function TabsList({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>): JSX.Element {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-lg bg-[--color-muted] p-1 text-[--color-muted-foreground]',
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
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-[--color-background] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-ring] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[--color-background] data-[state=active]:text-[--color-foreground] data-[state=active]:shadow',
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
        'mt-2 ring-offset-[--color-background] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-ring] focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    />
  );
}
