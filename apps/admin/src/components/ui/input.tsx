import { cn } from '@/lib/utils';
import type { InputHTMLAttributes, JSX } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type, ...props }: InputProps): JSX.Element {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-[--color-input] bg-[--color-background] px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[--color-muted-foreground] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-ring] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
