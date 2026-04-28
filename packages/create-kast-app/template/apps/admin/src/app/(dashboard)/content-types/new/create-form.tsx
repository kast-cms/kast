'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createApiClient } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type ChangeEvent, type FormEvent, type JSX } from 'react';

function toApiId(displayName: string): string {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function CreateContentTypeForm(): JSX.Element {
  const { session } = useSession();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [apiId, setApiId] = useState('');
  const [apiIdManuallyEdited, setApiIdManuallyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDisplayNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setDisplayName(value);
      if (!apiIdManuallyEdited) {
        setApiId(toApiId(value));
      }
    },
    [apiIdManuallyEdited],
  );

  const handleApiIdChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setApiIdManuallyEdited(true);
    setApiId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!displayName.trim() || !apiId.trim()) return;

      setIsSubmitting(true);
      setError(null);

      try {
        const client = createApiClient(session?.accessToken);
        const body: { name: string; displayName: string; description?: string; icon?: string } = {
          displayName: displayName.trim(),
          name: apiId.trim(),
        };
        if (description.trim() !== '') body.description = description.trim();
        if (icon.trim() !== '') body.icon = icon.trim();
        await client.contentTypes.create(body);
        router.push(`/content-types/${apiId.trim()}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        setError(message);
        setIsSubmitting(false);
      }
    },
    [session, displayName, apiId, description, icon, router],
  );

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="flex flex-col gap-y-6"
    >
      {error !== null && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-y-2">
        <Label htmlFor="displayName">Display Name</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={handleDisplayNameChange}
          placeholder="Blog Post"
          required
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">The human-readable name shown in the UI.</p>
      </div>

      <div className="grid gap-y-2">
        <Label htmlFor="apiId">API ID</Label>
        <Input
          id="apiId"
          value={apiId}
          onChange={handleApiIdChange}
          placeholder="blog-post"
          required
          pattern="[a-z0-9-]+"
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">
          Used in API endpoints. Only lowercase letters, numbers, and hyphens.
        </p>
      </div>

      <div className="grid gap-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
          }}
          placeholder="A short description (optional)"
          rows={3}
          disabled={isSubmitting}
        />
      </div>

      <div className="grid gap-y-2">
        <Label htmlFor="icon">Icon (emoji)</Label>
        <Input
          id="icon"
          value={icon}
          onChange={(e) => {
            setIcon(e.target.value);
          }}
          placeholder="📝"
          maxLength={4}
          disabled={isSubmitting}
        />
      </div>

      <div className="flex items-center gap-x-3 border-t pt-4">
        <Button type="submit" disabled={isSubmitting || !displayName.trim() || !apiId.trim()}>
          {isSubmitting ? 'Creating…' : 'Create content type'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isSubmitting}
          onClick={() => {
            router.push('/content-types');
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
