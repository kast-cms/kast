import { KastClient } from '@kast-cms/sdk';

if (!process.env.KAST_API_URL) {
  throw new Error('KAST_API_URL environment variable is required');
}

if (!process.env.KAST_API_KEY) {
  throw new Error('KAST_API_KEY environment variable is required');
}

export const kast = new KastClient({
  baseUrl: process.env.KAST_API_URL,
  apiKey: process.env.KAST_API_KEY,
});
