import { cn } from '@/lib/utils';
import * as LabelPrimitive from '@radix-ui/react-label';
import type { ComponentPropsWithoutRef, JSX } from 'react';

type LabelProps = ComponentPropsWithoutRef<typeof LabelPrimitive.Root>;

export function Label({ className, ...props }: LabelProps): JSX.Element {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
}
