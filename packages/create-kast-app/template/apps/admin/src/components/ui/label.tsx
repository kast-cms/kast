import { cn } from '@/lib/utils';
import * as LabelPrimitive from '@radix-ui/react-label';
import type { ComponentPropsWithoutRef, JSX } from 'react';

type LabelProps = ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & {
  /** Appends a muted asterisk. Purely visual — still set `required` on the input. */
  required?: boolean;
};

export function Label({ className, required, children, ...props }: LabelProps): JSX.Element {
  return (
    <LabelPrimitive.Root
      className={cn(
        'flex items-center gap-1.5 text-sm leading-none font-medium text-foreground select-none',
        'group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children}
      {required === true && (
        <span aria-hidden="true" className="text-destructive">
          *
        </span>
      )}
    </LabelPrimitive.Root>
  );
}

/** Helper text under a field. Switches to the destructive tone when `error`. */
export function FieldHint({
  className,
  error = false,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { error?: boolean }): JSX.Element {
  return (
    <p
      className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground', className)}
      {...props}
    />
  );
}
