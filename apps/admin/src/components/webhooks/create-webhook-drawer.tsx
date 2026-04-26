'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { CreateWebhookBody } from '@kast/sdk';
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
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="webhook-name">{t('nameLabel')}</Label>
            <Input
              id="webhook-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">{t('urlLabel')}</Label>
            <Input
              id="webhook-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhook"
            />
          </div>

          <div className="space-y-2">
            <Label>{t('eventsLabel')}</Label>
            <div className="space-y-2 rounded-md border p-3">
              {ALL_EVENTS.map((event) => (
                <label key={event} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event)}
                    onChange={() => toggleEvent(event)}
                    className="h-4 w-4"
                  />
                  <span className="font-mono text-xs">{event}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button disabled={!isValid || submitting} onClick={handleSubmit}>
            {submitting ? t('creating') : t('create')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
