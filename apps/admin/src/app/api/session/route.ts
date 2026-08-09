import { NextResponse } from 'next/server';

const ADMIN_SESSION_MAX_AGE_SEC = 12 * 60 * 60; // match API ADMIN session TTL

/**
 * Sets an httpOnly session cookie on the admin origin for SSR.
 * Client components authenticate to the API via credentials:include (API-domain cookie).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const token = body?.token?.trim();
  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_session', token, {
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SEC,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  return res;
}
