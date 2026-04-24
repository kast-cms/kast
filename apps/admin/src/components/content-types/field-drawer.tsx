'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import type { AddFieldBody, ContentField, ContentFieldType, UpdateFieldBody } from '@kast/sdk';
import { type ChangeEvent, type JSX } from 'react';
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
  return (
    <div className="rounded-md border p-4">
      <p className="mb-3 text-sm font-medium">Options</p>
      <div className="flex flex-col gap-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="opt-required" className="cursor-pointer">
            Required
          </Label>
          <Switch
            id="opt-required"
            checked={isRequired}
            onCheckedChange={setIsRequired}
            disabled={isSaving}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="opt-unique" className="cursor-pointer">
            Unique
          </Label>
          <Switch
            id="opt-unique"
            checked={isUnique}
            onCheckedChange={setIsUnique}
            disabled={isSaving}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="opt-localized" className="cursor-pointer">
            Localized
          </Label>
          <Switch
            id="opt-localized"
            checked={isLocalized}
            onCheckedChange={setIsLocalized}
            disabled={isSaving}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="opt-hidden" className="cursor-pointer">
            Hidden
          </Label>
          <Switch
            id="opt-hidden"
            checked={isHidden}
            onCheckedChange={setIsHidden}
            disabled={isSaving}
          />
        </div>
      </div>
    </div>
  );
}

export function FieldDrawer({ open, field, onClose, onSave }: FieldDrawerProps): JSX.Element {
  const isEdit = field !== null;
  const s = useFieldDrawer({ open, field, onClose, onSave });

  return (
    <Sheet open={open} onOpenChange={s.handleOpenChange}>
      <SheetContent className="flex flex-col gap-y-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="pb-4">
          <SheetTitle>{isEdit ? 'Edit field' : 'Add field'}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-y-6 overflow-y-auto pb-6">
          {s.error !== null && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {s.error}
            </div>
          )}
          {!isEdit && (
            <div className="grid gap-y-2">
              <Label htmlFor="field-name">Field name (API ID)</Label>
              <Input
                id="field-name"
                value={s.name}
                onChange={s.handleNameChange}
                placeholder="title"
                required
                disabled={s.isSaving}
              />
              <p className="text-xs text-muted-foreground">
                Only lowercase letters, numbers, and underscores.
              </p>
            </div>
          )}
          <div className="grid gap-y-2">
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
          </div>
          {!isEdit && (
            <div className="grid gap-y-2">
              <Label htmlFor="field-type">Field type</Label>
              <Select
                value={s.type}
                onValueChange={(v) => {
                  s.setType(v as ContentFieldType);
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
            </div>
          )}
          <div className="rounded-md border p-4">
            <p className="mb-3 text-sm font-medium">Configuration</p>
            <FieldTypeConfig
              type={isEdit ? field.type : s.type}
              config={s.config}
              onConfigChange={s.setConfig}
            />
          </div>
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
        </div>
        <SheetFooter className="border-t pt-4">
          <Button variant="ghost" onClick={onClose} disabled={s.isSaving}>
            Cancel
          </Button>
          <Button onClick={s.handleSaveClick} disabled={s.isSaving || (!isEdit && !s.name.trim())}>
            {s.isSaving ? 'Saving…' : 'Save field'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
