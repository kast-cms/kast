import { cn } from '@/lib/utils';
import type { JSX, TextareaHTMLAttributes } from 'react';
import { fieldBaseClasses } from './input';

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return (
    <textarea
      className={cn(
        fieldBaseClasses,
        // `field-sizing-content` lets the box grow with the text on browsers
        // that support it, while min-h keeps a sane floor everywhere else.
        'field-sizing-content min-h-20 px-3 py-2 text-sm',
        className,
      )}
      {...props}
    />
  );
}
