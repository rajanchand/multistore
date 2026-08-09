import { NextResponse } from 'next/server';

const CUSTOMER_SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60; // match API CUSTOMER session TTL

/**
 * Sets an httpOnly session cookie on the storefront origin for SSR.
 * Browser calls to the API use credentials:include (API-domain httpOnly cookie).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const token = body?.token?.trim();
  if (!token || token.length < 32) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('customer_session', token, {
    path: '/',
    maxAge: CUSTOMER_SESSION_MAX_AGE_SEC,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  return res;
}
