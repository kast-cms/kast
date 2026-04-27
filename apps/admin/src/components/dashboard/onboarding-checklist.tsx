'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { JSX } from 'react';

interface OnboardingStep {
  key: 'createContentType' | 'addContent' | 'uploadMedia' | 'inviteUser';
  href: string;
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
    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-5 shadow-sm dark:border-indigo-900 dark:bg-indigo-950/40">
      <h2 className="mb-1 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
        {t('title')}
      </h2>
      <p className="mb-4 text-xs text-indigo-600 dark:text-indigo-400">{t('description')}</p>
      <ol className="space-y-2">
        {STEPS.map((step, i) => (
          <li key={step.key} className="flex items-center gap-2 text-sm">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-200 text-[10px] font-bold text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200">
              {i + 1}
            </span>
            <Link
              href={step.href}
              className="text-indigo-700 underline underline-offset-2 hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-100"
            >
              {t(`steps.${step.key}`)}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
