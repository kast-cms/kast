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
import { Switch } from '@/components/ui/switch';
import { Save } from 'lucide-react';
import { useState, type JSX } from 'react';
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
    <div className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <Label>Default Content Status</Label>
        <Select value={defaultStatus} onValueChange={(v) => setDefaultStatus(v as ContentStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="version-retention">Version Retention Count</Label>
        <Input
          id="version-retention"
          value={versionRetention}
          onChange={(e) => setVersionRetention(e.target.value)}
          placeholder="10"
        />
        <p className="text-xs text-muted-foreground">
          Number of historical versions to keep per entry
        </p>
      </div>
      <div className="border-t pt-4 space-y-4">
        <p className="text-sm font-medium">Media</p>
        <div className="space-y-2">
          <Label htmlFor="img-quality">Image Quality (1–100)</Label>
          <Input
            id="img-quality"
            value={imageQuality}
            onChange={(e) => setImageQuality(e.target.value)}
            placeholder="80"
          />
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="thumbnails"
            checked={generateThumbnails}
            onCheckedChange={setGenerateThumbnails}
          />
          <Label htmlFor="thumbnails">Generate Thumbnails</Label>
        </div>
      </div>
      <Button
        onClick={() => {
          void save();
        }}
        disabled={s.saving}
        className="flex items-center gap-2"
      >
        <Save className="size-4" />
        {s.saving ? 'Saving…' : 'Save Content'}
      </Button>
    </div>
  );
}
