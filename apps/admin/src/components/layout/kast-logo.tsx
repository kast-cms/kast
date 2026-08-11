import kastMark from '@/assets/kast-logo.png';
import { cn } from '@/lib/utils';
import type { JSX } from 'react';

/**
 * The Kast mark. The artwork carries its own colour and transparency, so unlike
 * the previous currentColor drawing it renders the same on any surface and does
 * not follow the theme.
 */
export function KastLogo({ className }: { className?: string }): JSX.Element {
  return (
    <img
      src={kastMark.src}
      width={kastMark.width}
      height={kastMark.height}
      alt="Kast"
      className={cn('size-7 object-contain', className)}
      draggable={false}
    />
  );
}
