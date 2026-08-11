import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ContentTypeWithFields } from '../content-types/content-types.repository';
import { requireSlug } from './content-slug';
import type { ContentRepository, EntryWithLocale } from './content.repository';
import type { AddLocaleDto } from './dto/content-entry.dto';
import type { ContentWriteGate } from './validation/content-write.gate';
import { resolveValidationMode } from './validation/validation-mode';

/** Guards against a cycle in the locale fallback graph. */
const MAX_FALLBACK_DEPTH = 5;

/**
 * Resolves the fallback chain for a locale, starting with the locale itself.
 * Walks `Locale.fallbackCode` until it runs out or hits the depth cap, so a
 * mis-configured cycle degrades instead of looping forever.
 */
export async function resolveLocaleFallbackChain(
  prisma: PrismaService,
  localeCode: string,
): Promise<string[]> {
  const chain: string[] = [localeCode];
  let current = localeCode;

  for (let depth = 0; depth < MAX_FALLBACK_DEPTH; depth++) {
    const row = await prisma.locale.findUnique({
      where: { code: current },
      select: { fallbackCode: true },
    });
    const fallbackCode = row?.fallbackCode;
    if (!fallbackCode) break;
    chain.push(fallbackCode);
    current = fallbackCode;
  }

  return chain;
}

/**
 * A locale row is only writable for a locale the install actually serves:
 * delivery, the fallback chain and the admin all key off the `Locale` table, so
 * a row written for an unknown or retired code is content nothing can reach.
 */
export async function assertActiveLocale(repo: ContentRepository, code: string): Promise<void> {
  const active = await repo.findActiveLocaleCodes();
  if (!active.includes(code)) {
    throw new BadRequestException(`Locale "${code}" is not an active locale`);
  }
}

/**
 * Validates and writes a brand new locale onto an existing entry. A new locale on
 * a live entry is published the moment it is written, so it faces publish rules:
 * the mode comes from the entry, which is the only status this path can reach.
 */
export async function addEntryLocale(
  repo: ContentRepository,
  gate: ContentWriteGate,
  ct: ContentTypeWithFields,
  entry: EntryWithLocale,
  dto: AddLocaleDto,
): Promise<void> {
  if (entry.locales.some((l) => l.localeCode === dto.locale)) {
    throw new ConflictException(`Entry already has locale "${dto.locale}"`);
  }
  await assertActiveLocale(repo, dto.locale);

  // Optionally seed from another locale, then apply the supplied data on top.
  let seed: Record<string, unknown> = {};
  if (dto.copyFromLocale) {
    const source = entry.locales.find((l) => l.localeCode === dto.copyFromLocale);
    if (!source) {
      throw new BadRequestException(`Source locale "${dto.copyFromLocale}" not found on entry`);
    }
    seed = source.data as Record<string, unknown>;
  }

  const result = await gate.validatePayload(
    ct,
    { ...seed, ...dto.data },
    {
      mode: resolveValidationMode(entry.status),
      localeCode: dto.locale,
      applyDefaults: true,
      previousData: seed,
    },
  );

  await repo.addLocale(
    entry.id,
    ct.id,
    dto.locale,
    requireSlug(dto.slug, 'slug'),
    result.data,
    result.uniqueChecks,
  );
}
