'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { CreateWebhookBody } from '@kast-cms/sdk';
import { Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

const ALL_EVENTS = [
  'content.created',
  'content.updated',
  'content.published',
  'content.unpublished',
  'content.trashed',
  'media.uploaded',
  'user.created',
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (body: CreateWebhookBody) => Promise<void>;
}

export function CreateWebhookDrawer({ open, onOpenChange, onCreate }: Props): JSX.Element {
  const t = useTranslations('webhooks.createDrawer');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleEvent = (event: string): void => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const handleSubmit = (): void => {
    void (async (): Promise<void> => {
      setSubmitting(true);
      try {
        await onCreate({ name, url, events: selectedEvents });
        setName('');
        setUrl('');
        setSelectedEvents([]);
        onOpenChange(false);
      } finally {
        setSubmitting(false);
      }
    })();
  };

  const isValid = name.trim().length > 0 && url.trim().length > 0 && selectedEvents.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
        </SheetHeader>

        {/* Only the middle scrolls, so the title and the submit button stay put. */}
        <SheetBody className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="webhook-name" required>
              {t('nameLabel')}
            </Label>
            <Input
              id="webhook-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="webhook-url" required>
              {t('urlLabel')}
            </Label>
            <Input
              id="webhook-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              startAdornment={<Link2 />}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('eventsLabel')}</Label>
            <div className="space-y-0.5 rounded-lg border border-border bg-muted/40 p-2">
              {ALL_EVENTS.map((event) => (
                <label
                  key={event}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150 ease-out-quad hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedEvents.includes(event)}
                    onCheckedChange={() => toggleEvent(event)}
                  />
                  <span className="font-mono text-xs text-foreground">{event}</span>
                </label>
              ))}
            </div>
          </div>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button disabled={!isValid} loading={submitting} onClick={handleSubmit}>
            {submitting ? t('creating') : t('create')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
