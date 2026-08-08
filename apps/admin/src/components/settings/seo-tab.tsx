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
import { Textarea } from '@/components/ui/textarea';
import { Save } from 'lucide-react';
import { useState, type JSX } from 'react';
import { SettingsField } from './settings-field';
import type { UseSettingsReturn } from './use-settings';

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

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

  const titleHint = `${String(metaTitle.length)} / ${String(TITLE_LIMIT)} characters recommended`;
  const descHint = `${String(metaDesc.length)} / ${String(DESCRIPTION_LIMIT)} characters recommended`;

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Search metadata</CardTitle>
          <CardDescription>
            Fallback title and description for entries that do not define their own.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <SettingsField
            label="Default Meta Title"
            htmlFor="meta-title"
            hint={titleHint}
            hintError={metaTitle.length > TITLE_LIMIT}
          >
            <Input
              id="meta-title"
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder="My Site"
            />
          </SettingsField>

          <SettingsField
            label="Default Meta Description"
            htmlFor="meta-desc"
            hint={descHint}
            hintError={metaDesc.length > DESCRIPTION_LIMIT}
          >
            <Textarea
              id="meta-desc"
              rows={4}
              value={metaDesc}
              onChange={(e) => setMetaDesc(e.target.value)}
              placeholder="Brief site description…"
            />
          </SettingsField>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={() => {
              void save();
            }}
            loading={s.saving}
          >
            {!s.saving && <Save />}
            {s.saving ? 'Saving…' : 'Save SEO'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
