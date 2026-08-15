'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FieldHint, Label } from '@/components/ui/label';
import type { CreateAgentTokenBody } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

const TOOL_GROUPS = [
  {
    key: 'groupContentTypes',
    tools: [
      'list_content_types',
      'get_content_type',
      'create_content_type',
      'update_content_type',
      'add_content_type_field',
    ],
  },
  {
    key: 'groupContentEntries',
    tools: [
      'list_content_entries',
      'get_content_entry',
      'create_content_entry',
      'update_content_entry',
      'publish_content_entry',
      'unpublish_content_entry',
      'delete_content_entry',
    ],
  },
  {
    key: 'groupMediaSeo',
    tools: [
      'list_media',
      'get_media_file',
      'upload_media_from_url',
      'get_seo_score',
      'validate_seo',
      'create_redirect',
      'get_audit_log',
    ],
  },
  {
    key: 'groupPlatform',
    tools: ['list_plugins', 'enable_plugin', 'disable_plugin', 'invite_user'],
  },
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (body: CreateAgentTokenBody) => Promise<void>;
}

export function CreateAgentTokenDrawer({ open, onOpenChange, onCreate }: Props): JSX.Element {
  const t = useTranslations('agentTokens.createDrawer');
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleScope = (tool: string): void => {
    setScopes((prev) => (prev.includes(tool) ? prev.filter((s) => s !== tool) : [...prev, tool]));
  };

  const handleSubmit = (): void => {
    void (async (): Promise<void> => {
      setSubmitting(true);
      try {
        await onCreate({ name, scopes });
        setName('');
        setScopes([]);
        onOpenChange(false);
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="agent-token-name" required>
              {t('name')}
            </Label>
            <Input
              id="agent-token-name"
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('scopes')}</Label>
            <FieldHint>{t('scopesHint')}</FieldHint>

            {/* The tool list is long, so it scrolls inside its own panel rather
                than pushing the dialog past the viewport. */}
            <div className="max-h-72 space-y-4 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3">
              {TOOL_GROUPS.map((group) => (
                <fieldset key={group.key} className="space-y-0.5">
                  <legend className="mb-1 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {t(group.key)}
                  </legend>
                  {group.tools.map((tool) => (
                    <label
                      key={tool}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150 ease-out-quad hover:bg-accent"
                    >
                      <Checkbox
                        checked={scopes.includes(tool)}
                        onCheckedChange={() => toggleScope(tool)}
                      />
                      <span className="font-mono text-xs text-foreground">{tool}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name || scopes.length === 0}
            loading={submitting}
          >
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
