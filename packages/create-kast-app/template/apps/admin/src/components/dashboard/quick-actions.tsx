'use client';

import { Button } from '@/components/ui/button';
import { FileText, Image, List, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { JSX } from 'react';

interface QuickActionsProps {
  isAdmin: boolean;
}

export function QuickActions({ isAdmin }: QuickActionsProps): JSX.Element {
  const t = useTranslations('dashboard.quickActions');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size="sm">
        <Link href="/content">
          <FileText size={14} className="mr-1" />
          {t('newEntry')}
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href="/media">
          <Image size={14} className="mr-1" />
          {t('uploadMedia')}
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link href="/audit-log">
          <List size={14} className="mr-1" />
          {t('viewAuditLog')}
        </Link>
      </Button>
      {isAdmin && (
        <Button asChild size="sm" variant="outline">
          <Link href="/settings">
            <Settings size={14} className="mr-1" />
            {t('systemSettings')}
          </Link>
        </Button>
      )}
    </div>
  );
}
