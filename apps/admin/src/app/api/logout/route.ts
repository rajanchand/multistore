import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function POST(req: NextRequest) {
  const token = cookies().get('admin_session')?.value;
  if (token) {
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `admin_session=${token}`,
      },
      cache: 'no-store',
    }).catch(() => undefined);
  }

  const loginUrl = new URL('/login', req.url);
  const res = NextResponse.redirect(loginUrl, { status: 303 });
  res.cookies.set('admin_session', '', {
    path: '/',
    maxAge: 0,
    httpOnly: false,
  });
  return res;
}
