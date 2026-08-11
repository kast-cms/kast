import type { PrismaService } from '../../prisma/prisma.service';

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
