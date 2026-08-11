'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FieldHint, Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useApiClient, useSession } from '@/lib/session';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type ChangeEvent, type FormEvent, type JSX } from 'react';

function toApiId(displayName: string): string {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface OptionalFieldsProps {
  description: string;
  setDescription: (v: string) => void;
  icon: string;
  setIcon: (v: string) => void;
  isLocalized: boolean;
  setIsLocalized: (v: boolean) => void;
  disabled: boolean;
}

function OptionalFields({
  description,
  setDescription,
  icon,
  setIcon,
  isLocalized,
  setIsLocalized,
  disabled,
}: OptionalFieldsProps): JSX.Element {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
          }}
          placeholder="A short description (optional)"
          rows={3}
          disabled={disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="icon">Icon (emoji)</Label>
        <Input
          id="icon"
          className="w-24 text-center text-md"
          value={icon}
          onChange={(e) => {
            setIcon(e.target.value);
          }}
          placeholder="📝"
          maxLength={4}
          disabled={disabled}
        />
        <FieldHint>Shown next to the content type across the admin.</FieldHint>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
        <div className="space-y-1">
          <Label htmlFor="isLocalized">Localized</Label>
          <FieldHint>
            Creates a row per active locale for every entry, so the same entry can be translated.
            Leave off for content that exists once, regardless of language.
          </FieldHint>
        </div>
        <Switch
          id="isLocalized"
          checked={isLocalized}
          onCheckedChange={setIsLocalized}
          disabled={disabled}
        />
      </div>
    </>
  );
}

export function CreateContentTypeForm(): JSX.Element {
  const client = useApiClient();
  const { session } = useSession();
  const router = useRouter();

  const [displayName, setDisplayName] = useState('');
  const [apiId, setApiId] = useState('');
  const [apiIdManuallyEdited, setApiIdManuallyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [isLocalized, setIsLocalized] = useState(false);
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
        const body: {
          name: string;
          displayName: string;
          description?: string;
          icon?: string;
          isLocalized: boolean;
        } = {
          displayName: displayName.trim(),
          name: apiId.trim(),
          isLocalized,
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
    [session, displayName, apiId, description, icon, isLocalized, router, client],
  );

  return (
    <Card>
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <CardContent className="space-y-5">
          {error !== null && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="displayName" required>
              Display Name
            </Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={handleDisplayNameChange}
              placeholder="Blog Post"
              required
              disabled={isSubmitting}
            />
            <FieldHint>The human-readable name shown in the UI.</FieldHint>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiId" required>
              API ID
            </Label>
            <Input
              id="apiId"
              className="font-mono"
              value={apiId}
              onChange={handleApiIdChange}
              placeholder="blog-post"
              required
              pattern="[a-z0-9-]+"
              disabled={isSubmitting}
            />
            <FieldHint>
              Used in API endpoints. Only lowercase letters, numbers, and hyphens.
            </FieldHint>
          </div>

          <OptionalFields
            description={description}
            setDescription={setDescription}
            icon={icon}
            setIcon={setIcon}
            isLocalized={isLocalized}
            setIsLocalized={setIsLocalized}
            disabled={isSubmitting}
          />
        </CardContent>

        <CardFooter className="justify-end">
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
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={!displayName.trim() || !apiId.trim()}
          >
            {isSubmitting ? 'Creating…' : 'Create content type'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
