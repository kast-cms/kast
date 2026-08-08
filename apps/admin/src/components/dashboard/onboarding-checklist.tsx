'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, Rocket } from 'lucide-react';
import type { Route } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { JSX } from 'react';

interface OnboardingStep {
  key: 'createContentType' | 'addContent' | 'uploadMedia' | 'inviteUser';
  href: Route;
}

const STEPS: OnboardingStep[] = [
  { key: 'createContentType', href: '/content-types' },
  { key: 'addContent', href: '/content' },
  { key: 'uploadMedia', href: '/media' },
  { key: 'inviteUser', href: '/users' },
];

export function OnboardingChecklist(): JSX.Element {
  const t = useTranslations('dashboard.onboarding');

  return (
    <Card>
      <CardHeader className="grid-cols-[auto_1fr] items-center gap-x-3">
        <span
          aria-hidden="true"
          className="row-span-2 grid size-9 place-items-center rounded-lg bg-primary-subtle text-primary-subtle-foreground [&_svg]:size-4.5"
        >
          <Rocket />
        </span>
        <CardTitle className="col-start-2">{t('title')}</CardTitle>
        <CardDescription className="col-start-2">{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ol className="space-y-0.5">
          {STEPS.map((step, i) => (
            <li key={step.key}>
              <Link
                href={step.href}
                className="focus-ring group flex items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 ease-out-quad hover:bg-muted"
              >
                <span
                  aria-hidden="true"
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-subtle text-2xs font-semibold text-primary-subtle-foreground tabular-nums"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {t(`steps.${step.key}`)}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-colors duration-150 ease-out-quad group-hover:text-foreground rtl:rotate-180"
                />
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
