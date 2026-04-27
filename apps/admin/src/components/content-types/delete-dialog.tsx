'use client';

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
import { Label } from '@/components/ui/label';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
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
          <DialogTitle>Delete content type</DialogTitle>
          <DialogDescription>
            This action cannot be undone. All entries and fields associated with this content type
            will be permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-y-4 py-2">
          {error !== null && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-y-2">
            <Label htmlFor="confirm-api-id">
              Type <strong>{apiId}</strong> to confirm:
            </Label>
            <Input
              id="confirm-api-id"
              value={confirmation}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setConfirmation(e.target.value);
              }}
              placeholder={apiId}
              disabled={isDeleting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              void handleDelete();
            }}
            disabled={isDeleting || confirmation !== apiId}
          >
            {isDeleting ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
