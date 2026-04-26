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
import { Label } from '@/components/ui/label';
import type { CreateAgentTokenBody } from '@kast/sdk';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

const TOOL_GROUPS = [
  {
    key: 'groupContentTypes',
    tools: ['list_content_types', 'get_content_type', 'create_content_type', 'update_content_type'],
  },
  {
    key: 'groupContentEntries',
    tools: [
      'list_content_entries',
      'get_content_entry',
      'create_content_entry',
      'update_content_entry',
      'publish_content_entry',
      'delete_content_entry',
    ],
  },
  {
    key: 'groupMediaSeo',
    tools: ['list_media', 'get_media_file', 'get_seo_score', 'validate_seo', 'get_audit_log'],
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="agent-token-name">{t('name')}</Label>
            <Input
              id="agent-token-name"
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('scopes')}</Label>
            <p className="text-xs text-[--color-muted-foreground]">{t('scopesHint')}</p>
            {TOOL_GROUPS.map((group) => (
              <div key={group.key} className="space-y-1.5">
                <p className="text-xs font-medium text-[--color-foreground]">{t(group.key)}</p>
                {group.tools.map((tool) => (
                  <label key={tool} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={scopes.includes(tool)}
                      onCheckedChange={() => toggleScope(tool)}
                    />
                    <span className="font-mono">{tool}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!name || scopes.length === 0 || submitting}>
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
