import { NotFoundException } from '@nestjs/common';
import type { EntryWithLocale } from './content.repository';

/** Flattens an entry's locales into the shape stored on a version snapshot. */
export function snapshotLocales(entry: EntryWithLocale): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const loc of entry.locales) {
    out[loc.localeCode] = { slug: loc.slug, data: loc.data };
  }
  return out;
}

export function assertApplied(applied: boolean, id: string): void {
  if (!applied) throw new NotFoundException(`Content entry ${id} not found`);
}

export function localeData(entry: EntryWithLocale, localeCode: string): Record<string, unknown> {
  const match = entry.locales.find((l) => l.localeCode === localeCode);
  return (match?.data ?? {}) as Record<string, unknown>;
}

export function writeLocale(entry: EntryWithLocale, requested?: string): string {
  return requested ?? entry.locales[0]?.localeCode ?? 'en';
}
