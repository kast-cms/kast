'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldHint, Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import type { AddFieldBody, ContentField, ContentFieldType, UpdateFieldBody } from '@kast-cms/sdk';
import { type ChangeEvent, type JSX, type ReactNode } from 'react';
import { FieldTypeConfig } from './field-type-config';
import { useFieldDrawer } from './use-field-drawer';

const FIELD_TYPES: { value: ContentFieldType; label: string }[] = [
  { value: 'TEXT', label: 'Text' },
  { value: 'RICH_TEXT', label: 'Rich Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'BOOLEAN', label: 'Boolean' },
  { value: 'DATE', label: 'Date' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'RELATION', label: 'Relation' },
  { value: 'JSON', label: 'JSON' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'URL', label: 'URL' },
  { value: 'ENUM', label: 'Enum' },
  { value: 'UID', label: 'UID' },
];

export interface FieldDrawerProps {
  open: boolean;
  field: ContentField | null;
  onClose: () => void;
  onSave: (data: AddFieldBody | UpdateFieldBody, fieldName?: string) => Promise<void>;
}

/**
 * A titled, bordered block. The drawer has two of these (configuration and
 * options), and they need to read as siblings rather than as two panels that
 * happen to share a border radius.
 */
function DrawerSection({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="overflow-hidden rounded-lg border border-border">
      <h3 className="border-b border-border bg-muted/50 px-4 py-2.5 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

interface FieldOptionRow {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function FieldOptions({
  isRequired,
  isLocalized,
  isUnique,
  isHidden,
  isSaving,
  setIsRequired,
  setIsLocalized,
  setIsUnique,
  setIsHidden,
}: {
  isRequired: boolean;
  isLocalized: boolean;
  isUnique: boolean;
  isHidden: boolean;
  isSaving: boolean;
  setIsRequired: (v: boolean) => void;
  setIsLocalized: (v: boolean) => void;
  setIsUnique: (v: boolean) => void;
  setIsHidden: (v: boolean) => void;
}): JSX.Element {
  const rows: FieldOptionRow[] = [
    {
      id: 'opt-required',
      label: 'Required',
      hint: 'Entries cannot be saved while this field is empty.',
      checked: isRequired,
      onChange: setIsRequired,
    },
    {
      id: 'opt-unique',
      label: 'Unique',
      hint: 'No two entries may share the same value.',
      checked: isUnique,
      onChange: setIsUnique,
    },
    {
      id: 'opt-localized',
      label: 'Localized',
      hint: 'Stores a separate value for each locale.',
      checked: isLocalized,
      onChange: setIsLocalized,
    },
    {
      id: 'opt-hidden',
      label: 'Hidden',
      hint: 'Stays in the API but is hidden from the entry editor.',
      checked: isHidden,
      onChange: setIsHidden,
    },
  ];

  return (
    <DrawerSection title="Options">
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.id} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0 space-y-1">
              <Label htmlFor={row.id} className="cursor-pointer">
                {row.label}
              </Label>
              <FieldHint>{row.hint}</FieldHint>
            </div>
            <Switch
              id={row.id}
              className="mt-0.5 shrink-0"
              checked={row.checked}
              onCheckedChange={row.onChange}
              disabled={isSaving}
            />
          </div>
        ))}
      </div>
    </DrawerSection>
  );
}

/**
 * A field's type is immutable once it exists — changing it would invalidate
 * every entry already stored against it — so editing shows a read-only chip
 * where creating shows a picker.
 */
function FieldTypeControl({
  isEdit,
  activeType,
  value,
  onChange,
}: {
  isEdit: boolean;
  activeType: ContentFieldType;
  value: ContentFieldType;
  onChange: (next: ContentFieldType) => void;
}): JSX.Element {
  const typeLabel = FIELD_TYPES.find((ft) => ft.value === activeType)?.label ?? activeType;

  return (
    <div className="space-y-2">
      {/* Nothing is labelable in the read-only branch, so the association is
          dropped rather than pointed at a plain <div>. */}
      <Label htmlFor={isEdit ? undefined : 'field-type'}>Field type</Label>
      {isEdit ? (
        <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/60 px-3 text-sm text-muted-foreground">
          <span className="rounded-sm bg-card px-1.5 py-0.5 font-mono text-2xs font-medium tracking-wider uppercase">
            {activeType}
          </span>
          <span>{typeLabel}</span>
        </div>
      ) : (
        <Select
          value={value}
          onValueChange={(v) => {
            onChange(v as ContentFieldType);
          }}
        >
          <SelectTrigger id="field-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((ft) => (
              <SelectItem key={ft.value} value={ft.value}>
                {ft.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function DrawerIntro({ field }: { field: ContentField | null }): JSX.Element {
  return (
    <SheetHeader>
      <SheetTitle>{field === null ? 'Add field' : 'Edit field'}</SheetTitle>
      <SheetDescription>
        {field === null ? (
          'Fields define what an entry can hold. Name it, pick a type, then tune the details.'
        ) : (
          <>
            Editing <code className="font-mono text-foreground">{field.name}</code>. The API ID and
            type are fixed once a field exists.
          </>
        )}
      </SheetDescription>
    </SheetHeader>
  );
}

export function FieldDrawer({ open, field, onClose, onSave }: FieldDrawerProps): JSX.Element {
  const isEdit = field !== null;
  const s = useFieldDrawer({ open, field, onClose, onSave });
  const activeType = isEdit ? field.type : s.type;

  return (
    <Sheet open={open} onOpenChange={s.handleOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <DrawerIntro field={field} />

        <SheetBody className="space-y-6">
          {s.error !== null && (
            <Alert variant="destructive">
              <AlertDescription>{s.error}</AlertDescription>
            </Alert>
          )}

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="field-name" required>
                Field name (API ID)
              </Label>
              <Input
                id="field-name"
                className="font-mono"
                value={s.name}
                onChange={s.handleNameChange}
                placeholder="title"
                required
                disabled={s.isSaving}
              />
              <FieldHint>Only lowercase letters, numbers, and underscores.</FieldHint>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="field-displayName">Display name</Label>
            <Input
              id="field-displayName"
              value={s.displayName}
              placeholder="Title"
              disabled={s.isSaving}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                s.setDisplayNameEdited(true);
                s.setDisplayName(e.target.value);
              }}
            />
            <FieldHint>What editors see above the input.</FieldHint>
          </div>

          <FieldTypeControl
            isEdit={isEdit}
            activeType={activeType}
            value={s.type}
            onChange={s.setType}
          />

          <DrawerSection title="Configuration">
            <div className="px-4 py-4">
              <FieldTypeConfig type={activeType} config={s.config} onConfigChange={s.setConfig} />
            </div>
          </DrawerSection>

          <FieldOptions
            isRequired={s.isRequired}
            isLocalized={s.isLocalized}
            isUnique={s.isUnique}
            isHidden={s.isHidden}
            isSaving={s.isSaving}
            setIsRequired={s.setIsRequired}
            setIsLocalized={s.setIsLocalized}
            setIsUnique={s.setIsUnique}
            setIsHidden={s.setIsHidden}
          />
        </SheetBody>

        <SheetFooter>
          <Button variant="ghost" onClick={onClose} disabled={s.isSaving}>
            Cancel
          </Button>
          <Button
            onClick={s.handleSaveClick}
            loading={s.isSaving}
            disabled={!isEdit && !s.name.trim()}
          >
            {s.isSaving ? 'Saving…' : 'Save field'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
