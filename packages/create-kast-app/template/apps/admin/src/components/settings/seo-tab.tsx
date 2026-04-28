'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save } from 'lucide-react';
import { useState, type JSX } from 'react';
import type { UseSettingsReturn } from './use-settings';

interface Props {
  s: UseSettingsReturn;
}

export function SeoTab({ s }: Props): JSX.Element {
  const [metaTitle, setMetaTitle] = useState<string>(() =>
    String(s.getValue('seo.defaultMetaTitle') ?? ''),
  );
  const [metaDesc, setMetaDesc] = useState<string>(() =>
    String(s.getValue('seo.defaultMetaDescription') ?? ''),
  );

  const save = async (): Promise<void> => {
    await s.patchSettings([
      { key: 'seo.defaultMetaTitle', value: metaTitle },
      { key: 'seo.defaultMetaDescription', value: metaDesc },
    ]);
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <Label htmlFor="meta-title">Default Meta Title</Label>
        <Input
          id="meta-title"
          value={metaTitle}
          onChange={(e) => setMetaTitle(e.target.value)}
          placeholder="My Site"
        />
        <p className="text-xs text-muted-foreground">
          {metaTitle.length} / 60 characters recommended
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="meta-desc">Default Meta Description</Label>
        <Textarea
          id="meta-desc"
          rows={4}
          value={metaDesc}
          onChange={(e) => setMetaDesc(e.target.value)}
          placeholder="Brief site description…"
        />
        <p className="text-xs text-muted-foreground">
          {metaDesc.length} / 160 characters recommended
        </p>
      </div>
      <Button
        onClick={() => {
          void save();
        }}
        disabled={s.saving}
        className="flex items-center gap-2"
      >
        <Save className="size-4" />
        {s.saving ? 'Saving…' : 'Save SEO'}
      </Button>
    </div>
  );
}
