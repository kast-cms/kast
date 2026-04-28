import { REFRESH_TOKEN_COOKIE } from '@/config/env';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export interface SetSessionBody {
  refreshToken: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as SetSessionBody;
  const { refreshToken } = body;

  if (!refreshToken || typeof refreshToken !== 'string') {
    return NextResponse.json({ message: 'Missing refreshToken' }, { status: 400 });
  }

  const cookieStore = await cookies();
  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // 30 days — the API controls actual expiry; this is a ceiling
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true });
}
