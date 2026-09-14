import { adminRoute } from '@/config/env';
import type { TokenPair } from '@/types';

export async function persistSignIn(pair: TokenPair): Promise<void> {
  const response = await fetch(adminRoute('/api/auth/set-session'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: pair.refreshToken }),
  });
  if (!response.ok) throw new Error('Unable to save session');
}
