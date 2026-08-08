'use client';

import { cn } from '@/lib/utils';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import type { JSX } from 'react';

export function Switch({ className, ...props }: SwitchPrimitive.SwitchProps): JSX.Element {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-px',
        'transition-colors duration-200 ease-out-quad',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-card shadow-xs ring-0',
          'transition-transform duration-200 ease-spring',
          // RTL-aware: the thumb travels toward the inline end, whichever way
          // that is, so the control reads correctly in the `ar` locale.
          'data-[state=checked]:rtl:-translate-x-4 data-[state=checked]:translate-x-4',
          'data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
