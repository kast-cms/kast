import { cn } from '@/lib/utils';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import type { ComponentPropsWithoutRef, JSX } from 'react';

type AvatarRootProps = ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & {
  size?: 'xs' | 'sm' | 'default' | 'lg' | 'xl';
};
type AvatarImageProps = ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>;
type AvatarFallbackProps = ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>;

const SIZES = {
  xs: 'size-6 text-2xs',
  sm: 'size-7 text-2xs',
  default: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-16 text-lg',
} as const;

export function Avatar({ className, size = 'default', ...props }: AvatarRootProps): JSX.Element {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full ring-1 ring-border',
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export function AvatarImage({ className, ...props }: AvatarImageProps): JSX.Element {
  return (
    <AvatarPrimitive.Image
      className={cn('aspect-square size-full object-cover', className)}
      {...props}
    />
  );
}

export function AvatarFallback({ className, ...props }: AvatarFallbackProps): JSX.Element {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        // Tinted rather than grey: initials are often the only identity signal
        // in a row, so they should carry a little colour.
        'flex size-full items-center justify-center rounded-full bg-primary-subtle font-semibold text-primary-subtle-foreground uppercase',
        className,
      )}
      {...props}
    />
  );
}
