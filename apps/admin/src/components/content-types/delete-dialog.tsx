'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FieldHint, Label } from '@/components/ui/label';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type ChangeEvent, type JSX } from 'react';

interface DeleteContentTypeDialogProps {
  open: boolean;
  apiId: string;
  onClose: () => void;
}

export function DeleteContentTypeDialog({
  open,
  apiId,
  onClose,
}: DeleteContentTypeDialogProps): JSX.Element {
  const { session } = useSession();
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    if (confirmation !== apiId) return;

    setIsDeleting(true);
    setError(null);

    try {
      const client = createApiClient(session?.accessToken);
      await client.contentTypes.delete(apiId);
      router.push('/content-types');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
      setIsDeleting(false);
    }
  }, [session, apiId, confirmation, router]);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v && !isDeleting) {
        setConfirmation('');
        setError(null);
        onClose();
      }
    },
    [isDeleting, onClose],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-destructive-subtle text-destructive"
            >
              <AlertTriangle className="size-4.5" />
            </span>
            <div className="space-y-1.5">
              <DialogTitle>Delete content type</DialogTitle>
              <DialogDescription>
                This action cannot be undone. All entries and fields associated with this content
                type will be permanently deleted.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {error !== null && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirm-api-id">
              Type
              <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                {apiId}
              </code>
              to confirm
            </Label>
            <Input
              id="confirm-api-id"
              className="font-mono"
              value={confirmation}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setConfirmation(e.target.value);
              }}
              placeholder={apiId}
              disabled={isDeleting}
            />
            <FieldHint>The name must match exactly before deletion is enabled.</FieldHint>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              void handleDelete();
            }}
            loading={isDeleting}
            disabled={confirmation !== apiId}
          >
            {isDeleting ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
