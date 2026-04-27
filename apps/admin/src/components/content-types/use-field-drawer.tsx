import type { AddFieldBody, ContentField, ContentFieldType, UpdateFieldBody } from '@kast/sdk';
import { useCallback, useEffect, useState, type ChangeEvent } from 'react';

interface UseFieldDrawerParams {
  open: boolean;
  field: ContentField | null;
  onClose: () => void;
  onSave: (data: AddFieldBody | UpdateFieldBody, fieldName?: string) => Promise<void>;
}

export interface FieldDrawerState {
  name: string;
  displayName: string;
  type: ContentFieldType;
  config: Record<string, unknown>;
  isRequired: boolean;
  isLocalized: boolean;
  isUnique: boolean;
  isHidden: boolean;
  isSaving: boolean;
  error: string | null;
  setDisplayName: (v: string) => void;
  setDisplayNameEdited: (v: boolean) => void;
  setType: (v: ContentFieldType) => void;
  setConfig: (v: Record<string, unknown>) => void;
  setIsRequired: (v: boolean) => void;
  setIsLocalized: (v: boolean) => void;
  setIsUnique: (v: boolean) => void;
  setIsHidden: (v: boolean) => void;
  handleNameChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleOpenChange: (v: boolean) => void;
  handleSaveClick: () => void;
}

export function useFieldDrawer({
  open,
  field,
  onClose,
  onSave,
}: UseFieldDrawerParams): FieldDrawerState {
  const isEdit = field !== null;
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [displayNameEdited, setDisplayNameEdited] = useState(false);
  const [type, setType] = useState<ContentFieldType>('TEXT');
  const [isRequired, setIsRequired] = useState(false);
  const [isLocalized, setIsLocalized] = useState(false);
  const [isUnique, setIsUnique] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (field !== null) {
      setName(field.name);
      setDisplayName(field.displayName);
      setDisplayNameEdited(true);
      setType(field.type);
      setIsRequired(field.isRequired);
      setIsLocalized(field.isLocalized);
      setIsUnique(field.isUnique);
      setIsHidden(field.isHidden);
      setConfig(field.config);
    } else {
      setName('');
      setDisplayName('');
      setDisplayNameEdited(false);
      setType('TEXT');
      setIsRequired(false);
      setIsLocalized(false);
      setIsUnique(false);
      setIsHidden(false);
      setConfig({});
    }
    setError(null);
    setIsSaving(false);
  }, [open, field]);

  const handleNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
      setName(val);
      if (!displayNameEdited) {
        setDisplayName(val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
      }
    },
    [displayNameEdited],
  );

  const handleSave = useCallback(async () => {
    if (!name.trim() && !isEdit) return;
    setIsSaving(true);
    setError(null);
    try {
      if (isEdit) {
        const data: UpdateFieldBody = { isRequired, isLocalized, isUnique, isHidden, config };
        if (displayName.trim() !== '') data.displayName = displayName.trim();
        await onSave(data, field.name);
      } else {
        await onSave({
          name: name.trim(),
          displayName: displayName.trim() || name.trim(),
          type,
          isRequired,
          isLocalized,
          isUnique,
          isHidden,
          config,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setIsSaving(false);
    }
  }, [
    isEdit,
    name,
    displayName,
    type,
    isRequired,
    isLocalized,
    isUnique,
    isHidden,
    config,
    field,
    onSave,
    onClose,
  ]);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) onClose();
    },
    [onClose],
  );
  const handleSaveClick = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  return {
    name,
    displayName,
    type,
    config,
    isRequired,
    isLocalized,
    isUnique,
    isHidden,
    isSaving,
    error,
    setDisplayName,
    setDisplayNameEdited,
    setType,
    setConfig,
    setIsRequired,
    setIsLocalized,
    setIsUnique,
    setIsHidden,
    handleNameChange,
    handleOpenChange,
    handleSaveClick,
  };
}
