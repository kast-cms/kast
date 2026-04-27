'use client';

import { DeleteContentTypeDialog } from '@/components/content-types/delete-dialog';
import { FieldBuilder } from '@/components/content-types/field-builder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { ContentTypeDetail } from '@kast/sdk';
import { Trash2 } from 'lucide-react';
import { useCallback, useState, type ChangeEvent, type FormEvent, type JSX } from 'react';

interface EditContentTypeFormProps {
  initialData: ContentTypeDetail;
}

export function EditContentTypeForm({ initialData }: EditContentTypeFormProps): JSX.Element {
  const { session } = useSession();
  const [contentType, setContentType] = useState<ContentTypeDetail>(initialData);
  const [displayName, setDisplayName] = useState(initialData.displayName);
  const [description, setDescription] = useState(initialData.description ?? '');
  const [icon, setIcon] = useState(initialData.icon ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsSubmitting(true);
      setSaveError(null);
      setSaveSuccess(false);

      try {
        const client = createApiClient(session?.accessToken);
        const body: { displayName: string; description?: string; icon?: string } = {
          displayName: displayName.trim(),
        };
        if (description.trim() !== '') body.description = description.trim();
        if (icon.trim() !== '') body.icon = icon.trim();
        const result = await client.contentTypes.update(contentType.name, body);
        setContentType(result.data);
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        setSaveError(message);
      } finally {
        setIsSubmitting(false);
      }
    },
    [session, contentType.name, displayName, description, icon],
  );

  return (
    <div className="flex flex-col gap-y-8">
      {/* Meta form */}
      <div className="rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Content Type Settings</h2>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="flex flex-col gap-y-4"
        >
          {saveError !== null && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
              Changes saved successfully.
            </div>
          )}

          <div className="grid gap-y-2">
            <Label htmlFor="edit-displayName">Display Name</Label>
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

          <div className="grid gap-y-2">
            <Label>API ID</Label>
            <div className="flex items-center gap-x-2">
              <code className="rounded bg-muted px-3 py-2 text-sm font-mono">
                {contentType.name}
              </code>
              <span className="text-xs text-muted-foreground">
                {contentType.entriesCount > 0
                  ? '(locked — entries exist)'
                  : '(cannot be changed after creation)'}
              </span>
            </div>
          </div>

          <div className="grid gap-y-2">
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

          <div className="grid gap-y-2">
            <Label htmlFor="edit-icon">Icon (emoji)</Label>
            <Input
              id="edit-icon"
              value={icon}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setIcon(e.target.value);
              }}
              placeholder="📝"
              maxLength={4}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => {
                setDeleteOpen(true);
              }}
              disabled={contentType.isSystem}
            >
              <Trash2 className="me-2 h-4 w-4" />
              Delete content type
            </Button>
            <Button type="submit" disabled={isSubmitting || !displayName.trim()}>
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      </div>

      {/* Field builder */}
      <div className="rounded-lg border p-6">
        <FieldBuilder contentType={contentType} onUpdate={setContentType} />
      </div>

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
