import { cn } from '@/lib/utils';
import type { InputHTMLAttributes, JSX, ReactNode } from 'react';

/** Shared field chrome, so Input, Textarea and SelectTrigger stay identical. */
export const fieldBaseClasses = [
  'w-full min-w-0 rounded-md border border-input bg-card text-foreground shadow-2xs',
  'transition-[border-color,box-shadow,background-color] duration-150 ease-out-quad',
  'placeholder:text-muted-foreground/80',
  'hover:border-border-strong',
  'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25',
  'disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60',
  'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/25',
  'read-only:bg-muted/60',
].join(' ');

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Rendered inside the field, before the text — an icon or a prefix like `https://`. */
  startAdornment?: ReactNode;
  /** Rendered inside the field, after the text — a unit, a clear button, a badge. */
  endAdornment?: ReactNode;
}

export function Input({
  className,
  type,
  startAdornment,
  endAdornment,
  ...props
}: InputProps): JSX.Element {
  const control = (
    <input
      type={type}
      className={cn(
        fieldBaseClasses,
        'h-9 px-3 py-1 text-sm',
        'file:mr-3 file:h-7 file:cursor-pointer file:rounded-sm file:border-0 file:bg-secondary file:px-2.5 file:text-xs file:font-medium file:text-secondary-foreground',
        // Adornments are absolutely positioned over the field, so the text needs
        // to be inset to make room for them.
        startAdornment !== undefined && 'ps-9',
        endAdornment !== undefined && 'pe-9',
        className,
      )}
      {...props}
    />
  );

  if (startAdornment === undefined && endAdornment === undefined) return control;

  return (
    <div className="relative flex w-full items-center">
      {startAdornment !== undefined && (
        <span className="pointer-events-none absolute start-3 flex items-center text-muted-foreground [&_svg]:size-4">
          {startAdornment}
        </span>
      )}
      {control}
      {endAdornment !== undefined && (
        <span className="absolute end-3 flex items-center text-muted-foreground [&_svg]:size-4">
          {endAdornment}
        </span>
      )}
    </div>
  );
}
