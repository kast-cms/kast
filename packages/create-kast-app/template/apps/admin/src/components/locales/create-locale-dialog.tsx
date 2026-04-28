'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreateLocaleBody, TextDirection } from '@kast-cms/sdk';
import { useTranslations } from 'next-intl';
import { useState, type JSX } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (body: CreateLocaleBody) => Promise<void>;
}

export function CreateLocaleDialog({ open, onOpenChange, onCreate }: Props): JSX.Element {
  const t = useTranslations('locales.createDialog');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [nativeName, setNativeName] = useState('');
  const [direction, setDirection] = useState<TextDirection>('LTR');
  const [fallbackCode, setFallbackCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (): void => {
    void (async (): Promise<void> => {
      setSubmitting(true);
      try {
        const body: CreateLocaleBody = {
          code: code.trim(),
          name: name.trim(),
          nativeName: nativeName.trim(),
          direction,
          ...(fallbackCode.trim() ? { fallbackCode: fallbackCode.trim() } : {}),
        };
        await onCreate(body);
        setCode('');
        setName('');
        setNativeName('');
        setDirection('LTR');
        setFallbackCode('');
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
            <Label htmlFor="locale-code">{t('code')}</Label>
            <Input
              id="locale-code"
              placeholder="en, ar, fr-FR"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="locale-name">{t('name')}</Label>
            <Input id="locale-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="locale-native">{t('nativeName')}</Label>
            <Input
              id="locale-native"
              value={nativeName}
              onChange={(e) => setNativeName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="locale-direction">{t('direction')}</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as TextDirection)}>
              <SelectTrigger id="locale-direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LTR">{t('ltr')}</SelectItem>
                <SelectItem value="RTL">{t('rtl')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="locale-fallback">{t('fallbackCode')}</Label>
            <Input
              id="locale-fallback"
              placeholder="en"
              value={fallbackCode}
              onChange={(e) => setFallbackCode(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !code || !name || !nativeName}>
            {submitting ? t('saving') : t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
