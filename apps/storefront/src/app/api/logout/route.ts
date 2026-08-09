import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function POST(req: NextRequest) {
  const token = cookies().get('customer_session')?.value;
  if (token) {
    await fetch(`${API_URL}/api/v1/customer-auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `customer_session=${token}`,
      },
      cache: 'no-store',
    }).catch(() => undefined);
  }

  const accountUrl = new URL('/account', req.url);
  const res = NextResponse.redirect(accountUrl, { status: 303 });
  res.cookies.set('customer_session', '', {
    path: '/',
    maxAge: 0,
    httpOnly: false,
  });
  return res;
}
