import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // Phase 2 starts with English only. RTL + multi-locale lands in WS-8 (Sprint 7).
  const locale = 'en';

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)) as Record<string, unknown>,
  };
});
