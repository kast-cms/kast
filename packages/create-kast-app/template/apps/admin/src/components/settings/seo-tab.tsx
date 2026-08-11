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
import { Textarea } from '@/components/ui/textarea';
import { blankToNull } from '@/lib/nullable-field';
import { Save } from 'lucide-react';
import { useState, type JSX } from 'react';
import { SettingsField } from './settings-field';
import type { UseSettingsReturn } from './use-settings';

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

const GATE_POLICIES = ['enforce', 'advisory', 'disabled'] as const;
type GatePolicy = (typeof GATE_POLICIES)[number];

const GATE_POLICY_HINTS: Record<GatePolicy, string> = {
  enforce: 'Score the entry and refuse to publish while an ERROR-level issue stands.',
  advisory: 'Score and record issues, but never block a publish.',
  disabled: 'Skip SEO analysis entirely.',
};

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
  // '' means "no override": the API then falls back to its own heuristic —
  // enforce for a type with a rich-text body, advisory for one without.
  const [gatePolicy, setGatePolicy] = useState<GatePolicy | ''>(() => {
    const v = s.getValue('seo.gate.defaultPolicy');
    return GATE_POLICIES.includes(v as GatePolicy) ? (v as GatePolicy) : '';
  });
  const [allowedHosts, setAllowedHosts] = useState<string>(() => {
    const v = s.getValue('seo.redirects.allowedHosts');
    return Array.isArray(v) ? (v as string[]).join('\n') : String(v ?? '');
  });

  const save = async (): Promise<void> => {
    // A cleared default is stored as null, like the gate policy below it: the
    // API treats a blank string as "no default", so keeping '' in the row would
    // leave the screen showing an override that does not exist.
    await s.patchSettings([
      { key: 'seo.defaultMetaTitle', value: blankToNull(metaTitle) },
      { key: 'seo.defaultMetaDescription', value: blankToNull(metaDesc) },
      { key: 'seo.gate.defaultPolicy', value: gatePolicy === '' ? null : gatePolicy },
      {
        key: 'seo.redirects.allowedHosts',
        value: allowedHosts
          .split('\n')
          .map((h) => h.trim())
          .filter(Boolean),
      },
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

          <SeparatorWithLabel>Publish gate</SeparatorWithLabel>

          <SettingsField
            label="Default gate policy"
            htmlFor="gate-policy"
            hint={
              gatePolicy === ''
                ? 'Automatic: types with a rich-text body are enforced, the rest are advisory.'
                : GATE_POLICY_HINTS[gatePolicy]
            }
          >
            <Select
              value={gatePolicy === '' ? '__auto__' : gatePolicy}
              onValueChange={(v) => setGatePolicy(v === '__auto__' ? '' : (v as GatePolicy))}
            >
              <SelectTrigger id="gate-policy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__auto__">Automatic (recommended)</SelectItem>
                {GATE_POLICIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>

          <SeparatorWithLabel>Redirects</SeparatorWithLabel>

          <SettingsField
            label="Allowed redirect hosts"
            htmlFor="redirect-hosts"
            hint="One hostname per line. Site-relative targets are always allowed; an absolute http(s) target is refused unless its host is listed here. Empty means no off-site redirects."
          >
            <Textarea
              id="redirect-hosts"
              rows={4}
              value={allowedHosts}
              onChange={(e) => setAllowedHosts(e.target.value)}
              placeholder="shop.example.com"
              className="font-mono text-sm"
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
