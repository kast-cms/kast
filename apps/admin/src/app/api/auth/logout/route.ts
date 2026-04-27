import { INTERNAL_API_URL, REFRESH_TOKEN_COOKIE } from '@/config/env';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const rt = cookieStore.get(REFRESH_TOKEN_COOKIE);

  // Best-effort call to the API to invalidate the refresh token server-side
  if (rt?.value) {
    try {
      await fetch(`${INTERNAL_API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt.value }),
      });
    } catch {
      // Swallow — we still clear the cookie regardless
    }
  }

  cookieStore.delete(REFRESH_TOKEN_COOKIE);

  return new NextResponse(null, { status: 204 });
}
