import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminPath } from '@/lib/admin-path';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

function isHttps(req: NextRequest): boolean {
  if (req.nextUrl.protocol === 'https:') return true;
  const forwarded = req.headers.get('x-forwarded-proto');
  if (forwarded?.split(',')[0]?.trim() === 'https') return true;
  return false;
}

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

  const loginUrl = new URL(adminPath('/login'), req.url);
  const res = NextResponse.redirect(loginUrl, { status: 303 });
  res.cookies.set('admin_session', '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: isHttps(req),
    sameSite: 'lax',
  });
  return res;
}
