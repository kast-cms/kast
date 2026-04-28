'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
    <div className="space-y-4 rounded-lg border border-[--color-border] p-4">
      <p className="text-sm font-semibold">{t('panelTitle')}</p>
      <div className="space-y-1">
        <Label htmlFor="seo-meta-title">{t('metaTitle')}</Label>
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
      <div className="space-y-1">
        <Label htmlFor="seo-meta-desc">{t('metaDescription')}</Label>
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
      <div className="space-y-1">
        <Label htmlFor="seo-canonical">{t('canonicalUrl')}</Label>
        <Input
          id="seo-canonical"
          type="url"
          value={canonicalUrl}
          disabled={disabled}
          onChange={(e) => {
            onChange('canonicalUrl', e.target.value);
          }}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="seo-og-image">{t('ogImage')}</Label>
        <Input
          id="seo-og-image"
          type="url"
          value={ogImage}
          disabled={disabled}
          onChange={(e) => {
            onChange('ogImage', e.target.value);
          }}
        />
      </div>
    </div>
  );
}
