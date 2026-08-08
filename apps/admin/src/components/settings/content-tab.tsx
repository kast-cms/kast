'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SeparatorWithLabel } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Save } from 'lucide-react';
import { useState, type JSX } from 'react';
import { SettingsField, SettingsToggleField } from './settings-field';
import type { UseSettingsReturn } from './use-settings';

type ContentStatus = 'DRAFT' | 'PUBLISHED';

interface Props {
  s: UseSettingsReturn;
}

export function ContentTab({ s }: Props): JSX.Element {
  const [defaultStatus, setDefaultStatus] = useState<ContentStatus>(
    () => (s.getValue('content.defaultStatus') as ContentStatus | undefined) ?? 'DRAFT',
  );
  const [versionRetention, setVersionRetention] = useState<string>(() =>
    String(s.getValue('content.versionRetention') ?? '10'),
  );
  const [imageQuality, setImageQuality] = useState<string>(() =>
    String(s.getValue('media.imageQuality') ?? '80'),
  );
  const [generateThumbnails, setGenerateThumbnails] = useState<boolean>(() =>
    Boolean(s.getValue('media.generateThumbnails') ?? true),
  );

  const save = async (): Promise<void> => {
    await s.patchSettings([
      { key: 'content.defaultStatus', value: defaultStatus },
      { key: 'content.versionRetention', value: parseInt(versionRetention, 10) },
      { key: 'media.imageQuality', value: parseInt(imageQuality, 10) },
      { key: 'media.generateThumbnails', value: generateThumbnails },
    ]);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Content</CardTitle>
          <CardDescription>Defaults applied to newly created entries and versions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <SettingsField
            label="Default Content Status"
            htmlFor="default-status"
            required
            hint="The status a new entry starts in before anyone touches it."
          >
            <Select
              value={defaultStatus}
              onValueChange={(v) => setDefaultStatus(v as ContentStatus)}
            >
              <SelectTrigger id="default-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>

          <SettingsField
            label="Version Retention Count"
            htmlFor="version-retention"
            required
            hint="Number of historical versions to keep per entry. Older ones are pruned."
          >
            <Input
              id="version-retention"
              value={versionRetention}
              onChange={(e) => setVersionRetention(e.target.value)}
              placeholder="10"
            />
          </SettingsField>

          <SeparatorWithLabel>Media</SeparatorWithLabel>

          <SettingsField
            label="Image Quality"
            htmlFor="img-quality"
            hint="1–100. Higher keeps more detail at the cost of file size."
          >
            <Input
              id="img-quality"
              value={imageQuality}
              onChange={(e) => setImageQuality(e.target.value)}
              placeholder="80"
            />
          </SettingsField>

          <SettingsToggleField
            label="Generate Thumbnails"
            htmlFor="thumbnails"
            hint="Derive smaller previews when an image is uploaded."
            control={
              <Switch
                id="thumbnails"
                checked={generateThumbnails}
                onCheckedChange={setGenerateThumbnails}
              />
            }
          />
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={() => {
              void save();
            }}
            loading={s.saving}
          >
            {!s.saving && <Save />}
            {s.saving ? 'Saving…' : 'Save Content'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
