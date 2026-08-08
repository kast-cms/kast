import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

const SUPPORTED_LOCALES = ['en', 'ar'];
const DEFAULT_LOCALE = 'en';
const LOCALE_COOKIE = 'NEXT_LOCALE';

export default getRequestConfig(async ({ requestLocale }) => {
  // Routes are unprefixed, so there is no locale segment for next-intl to read
  // and `requestLocale` is undefined. Fall back to the NEXT_LOCALE cookie, which
  // is what a locale switcher sets, then to the default.
  const requested = (await requestLocale) ?? (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale =
    requested !== undefined && SUPPORTED_LOCALES.includes(requested) ? requested : DEFAULT_LOCALE;

  return {
    locale,
    // `await import()` of a JSON module resolves to the module namespace, not the
    // messages object. Passing that namespace to NextIntlClientProvider makes React
    // reject it as a non-plain object and every page 500s, so unwrap `default`.
    messages: ((await import(`../messages/${locale}.json`)) as { default: Record<string, unknown> })
      .default,
  };
});
