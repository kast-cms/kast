'use client';

import { DeleteContentTypeDialog } from '@/components/content-types/delete-dialog';
import { FieldBuilder } from '@/components/content-types/field-builder';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FieldHint, Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useApiClient, useSession } from '@/lib/session';
import type { ContentTypeDetail } from '@kast-cms/sdk';
import { Lock, Trash2 } from 'lucide-react';
import { useCallback, useState, type ChangeEvent, type FormEvent, type JSX } from 'react';

interface EditContentTypeFormProps {
  initialData: ContentTypeDetail;
}

interface SettingsCardProps {
  contentType: ContentTypeDetail;
  onUpdated: (next: ContentTypeDetail) => void;
}

/** Name, API ID, description and icon — everything editable about the type itself. */
function SettingsCard({ contentType, onUpdated }: SettingsCardProps): JSX.Element {
  const client = useApiClient();
  const { session } = useSession();
  const [displayName, setDisplayName] = useState(contentType.displayName);
  const [description, setDescription] = useState(contentType.description ?? '');
  const [isLocalized, setIsLocalized] = useState(contentType.isLocalized);
  const [icon, setIcon] = useState(contentType.icon ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsSubmitting(true);
      setSaveError(null);
      setSaveSuccess(false);

      try {
        const body: {
          displayName: string;
          description?: string;
          icon?: string;
          isLocalized: boolean;
        } = {
          displayName: displayName.trim(),
          isLocalized,
        };
        if (description.trim() !== '') body.description = description.trim();
        if (icon.trim() !== '') body.icon = icon.trim();
        const result = await client.contentTypes.update(contentType.name, body);
        onUpdated(result.data);
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [session, contentType.name, displayName, description, icon, isLocalized, onUpdated, client],
  );

  return (
    <Card>
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            How this content type is named and presented across the admin.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {saveError !== null && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          {saveSuccess && (
            <Alert variant="success">
              <AlertDescription>Changes saved successfully.</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-displayName" required>
              Display Name
            </Label>
            <Input
              id="edit-displayName"
              value={displayName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setDisplayName(e.target.value);
              }}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-apiId">API ID</Label>
            <Input
              id="edit-apiId"
              className="font-mono"
              value={contentType.name}
              readOnly
              endAdornment={<Lock aria-hidden="true" />}
            />
            <FieldHint>
              {contentType.entriesCount > 0
                ? 'Locked — entries already exist for this content type.'
                : 'Cannot be changed after creation.'}
            </FieldHint>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                setDescription(e.target.value);
              }}
              placeholder="A short description (optional)"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-icon">Icon (emoji)</Label>
            <Input
              id="edit-icon"
              className="text-md w-24 text-center"
              value={icon}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setIcon(e.target.value);
              }}
              placeholder="📝"
              maxLength={4}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
            <div className="space-y-1">
              <Label htmlFor="edit-isLocalized">Localized</Label>
              <FieldHint>
                Creates a row per active locale for every entry, so the same entry can be
                translated. Turning this off does not delete translations already stored.
              </FieldHint>
            </div>
            <Switch
              id="edit-isLocalized"
              checked={isLocalized}
              onCheckedChange={setIsLocalized}
              disabled={isSubmitting}
            />
          </div>
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="submit" loading={isSubmitting} disabled={!displayName.trim()}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

/** Irreversible actions, fenced off in their own destructive-tinted card. */
function DangerZoneCard({
  isSystem,
  onDelete,
}: {
  isSystem: boolean;
  onDelete: () => void;
}): JSX.Element {
  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-5">
        <CardTitle>Danger zone</CardTitle>
        <CardDescription>
          {isSystem
            ? 'System content types are managed by Kast and cannot be deleted.'
            : 'Deleting this content type permanently removes its fields and every entry created from it.'}
        </CardDescription>
        <CardAction>
          <Button type="button" variant="destructive" onClick={onDelete} disabled={isSystem}>
            <Trash2 />
            Delete content type
          </Button>
        </CardAction>
      </CardHeader>
    </Card>
  );
}

export function EditContentTypeForm({ initialData }: EditContentTypeFormProps): JSX.Element {
  const [contentType, setContentType] = useState<ContentTypeDetail>(initialData);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="space-y-6">
      <SettingsCard contentType={contentType} onUpdated={setContentType} />

      <FieldBuilder contentType={contentType} onUpdate={setContentType} />

      <DangerZoneCard
        isSystem={contentType.isSystem}
        onDelete={() => {
          setDeleteOpen(true);
        }}
      />

      <DeleteContentTypeDialog
        open={deleteOpen}
        apiId={contentType.name}
        onClose={() => {
          setDeleteOpen(false);
        }}
      />
    </div>
  );
}
