'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Image as ImageIcon, Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';

interface SeoPanelProps {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  ogImage: string;
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
}

/** Budget indicator for the length-capped SEO fields; warns before the cut-off. */
function CharacterCount({ value, max }: { value: string; max: number }): JSX.Element {
  const nearLimit = value.length >= max * 0.9;
  return (
    <span
      aria-hidden="true"
      className={cn(
        'text-2xs tabular-nums',
        nearLimit ? 'font-medium text-warning' : 'text-muted-foreground',
      )}
    >
      {value.length}/{max}
    </span>
  );
}

export function SeoPanel({
  metaTitle,
  metaDescription,
  canonicalUrl,
  ogImage,
  onChange,
  disabled,
}: SeoPanelProps): JSX.Element {
  const t = useTranslations('content.seo');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('panelTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="seo-meta-title">{t('metaTitle')}</Label>
            <CharacterCount value={metaTitle} max={70} />
          </div>
          <Input
            id="seo-meta-title"
            value={metaTitle}
            maxLength={70}
            disabled={disabled}
            onChange={(e) => {
              onChange('metaTitle', e.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="seo-meta-desc">{t('metaDescription')}</Label>
            <CharacterCount value={metaDescription} max={160} />
          </div>
          <Textarea
            id="seo-meta-desc"
            value={metaDescription}
            rows={3}
            maxLength={160}
            disabled={disabled}
            onChange={(e) => {
              onChange('metaDescription', e.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="seo-canonical">{t('canonicalUrl')}</Label>
          <Input
            id="seo-canonical"
            type="url"
            value={canonicalUrl}
            disabled={disabled}
            startAdornment={<Link2 />}
            onChange={(e) => {
              onChange('canonicalUrl', e.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="seo-og-image">{t('ogImage')}</Label>
          <Input
            id="seo-og-image"
            type="url"
            value={ogImage}
            disabled={disabled}
            startAdornment={<ImageIcon />}
            onChange={(e) => {
              onChange('ogImage', e.target.value);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
