import { FieldHint, Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { JSX, ReactNode } from 'react';

interface SettingsFieldProps {
  /** Visible label text. */
  label: ReactNode;
  /** `id` of the control this label points at. */
  htmlFor?: string;
  /** Helper text rendered under the control. */
  hint?: ReactNode;
  /** Switches the hint to the destructive tone — e.g. an over-budget counter. */
  hintError?: boolean;
  /** Appends the muted asterisk to the label. */
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * One `label → control → hint` row.
 *
 * Every settings field on every tab uses this shape, so the vertical rhythm of
 * a form never depends on which tab you happen to be looking at.
 */
export function SettingsField({
  label,
  htmlFor,
  hint,
  hintError = false,
  required = false,
  className,
  children,
}: SettingsFieldProps): JSX.Element {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {hint !== undefined && <FieldHint error={hintError}>{hint}</FieldHint>}
    </div>
  );
}

interface SettingsToggleFieldProps {
  label: ReactNode;
  /** `id` of the switch this label points at. */
  htmlFor: string;
  hint?: ReactNode;
  /** The `<Switch>` rendered at the inline end of the row. */
  control: ReactNode;
  className?: string;
}

/**
 * A boolean row: the explanation carries the weight on the start side and the
 * control sits at the end, on its own tinted track. A naked switch next to a
 * two-word label gives the reader nowhere to learn what it does.
 */
export function SettingsToggleField({
  label,
  htmlFor,
  hint,
  control,
  className,
}: SettingsToggleFieldProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/50 px-4 py-3',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        {hint !== undefined && <FieldHint>{hint}</FieldHint>}
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}
