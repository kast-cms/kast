import { KastClient } from '@kast-cms/sdk';

export const kast = new KastClient({
  baseUrl: process.env.KAST_API_URL ?? 'http://localhost:3000',
  apiKey: process.env.KAST_API_KEY ?? 'build-placeholder',
});
