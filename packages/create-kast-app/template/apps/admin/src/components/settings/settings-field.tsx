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

interface EnvManagedFieldProps {
  label: ReactNode;
  /** The environment variable that actually decides this value. */
  envVar: string;
  /** What the value is right now, when the admin can know it. */
  value?: ReactNode;
  hint?: ReactNode;
}

/**
 * A setting the API stores nowhere and reads from the environment.
 *
 * These used to be editable controls whose Save button silently did nothing;
 * the API now hides the rows and rejects a write naming the real source, so an
 * editable control here would only produce a 400. Showing the variable name is
 * the useful thing an operator can act on.
 */
export function EnvManagedField({ label, envVar, value, hint }: EnvManagedFieldProps): JSX.Element {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
        {value !== undefined && (
          <p className="truncate font-mono text-sm text-foreground">{value}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Set by the <code className="font-mono text-foreground">{envVar}</code> environment
          variable.
        </p>
      </div>
      {hint !== undefined && <FieldHint>{hint}</FieldHint>}
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
