import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SESSION_MAX_AGE_SEC = 12 * 60 * 60; // match API ADMIN session TTL

function isHttps(req: NextRequest): boolean {
  if (req.nextUrl.protocol === 'https:') return true;
  const forwarded = req.headers.get('x-forwarded-proto');
  if (forwarded?.split(',')[0]?.trim() === 'https') return true;
  return false;
}

/**
 * Sets an httpOnly session cookie on the admin origin for SSR.
 * Client components authenticate to the API via credentials:include (API-domain cookie).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const token = body?.token?.trim();
  if (!token || token.length < 20) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('admin_session', token, {
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SEC,
    httpOnly: true,
    // Only mark Secure on real HTTPS (avoids failed cookies on http://localhost production builds).
    secure: isHttps(req),
    sameSite: 'lax',
  });
  return res;
}
