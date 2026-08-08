import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Compass } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { JSX } from 'react';

export default function NotFound(): JSX.Element {
  const t = useTranslations('notFound');

  return (
    <div className="surface-gradient grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        <div
          aria-hidden="true"
          className="grid size-14 place-items-center rounded-2xl bg-primary-subtle text-primary-subtle-foreground"
        >
          <Compass className="size-7" />
        </div>

        <div className="space-y-2">
          <Badge variant="muted" size="lg" className="font-mono tracking-wider">
            404
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
          <p className="text-sm text-balance text-muted-foreground">{t('description')}</p>
        </div>

        <Button className="mt-1" asChild>
          <Link href="/content-types">{t('back')}</Link>
        </Button>
      </div>
    </div>
  );
}
