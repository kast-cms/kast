import { INTERNAL_API_URL, REFRESH_TOKEN_COOKIE } from '@/config/env';
import type { TokenPair } from '@/types';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const rt = cookieStore.get(REFRESH_TOKEN_COOKIE);

  if (!rt?.value) {
    return NextResponse.json({ message: 'No refresh token' }, { status: 401 });
  }

  let result: TokenPair;

  try {
    const res = await fetch(`${INTERNAL_API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt.value }),
    });

    if (!res.ok) {
      // Clear invalid cookie
      cookieStore.delete(REFRESH_TOKEN_COOKIE);
      return NextResponse.json({ message: 'Refresh failed' }, { status: 401 });
    }

    const body = (await res.json()) as { data: TokenPair };
    result = body.data;
  } catch {
    return NextResponse.json({ message: 'Upstream error' }, { status: 502 });
  }

  // Rotate the refresh token cookie with the new value
  cookieStore.set(REFRESH_TOKEN_COOKIE, result.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ data: result });
}
