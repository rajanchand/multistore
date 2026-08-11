import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4000';
const ADMIN_SESSION_MAX_AGE_SEC = 12 * 60 * 60;

function isHttps(req: NextRequest): boolean {
  if (req.nextUrl.protocol === 'https:') return true;
  const forwarded = req.headers.get('x-forwarded-proto');
  if (forwarded?.split(',')[0]?.trim() === 'https') return true;
  return false;
}

/**
 * Same-origin admin login:
 * 1) Authenticate against the API from the Next server
 * 2) Set httpOnly admin_session on the admin origin
 *
 * Avoids browser→:4000 CORS / connectivity failures on remote previews.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    password?: string;
    mfaCode?: string;
  } | null;

  const email = body?.email?.trim() ?? '';
  const password = body?.password ?? '';
  const mfaCode = body?.mfaCode?.trim();

  if (!email || !password) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Email/username and password are required.' } },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        ...(mfaCode ? { mfaCode } : {}),
      }),
      cache: 'no-store',
    });

    const text = await upstream.text();
    type LoginResponseBody = {
      token?: string;
      user?: unknown;
      error?: { code?: string; message?: string };
    };
    let data: LoginResponseBody | null = null;
    try {
      data = JSON.parse(text) as LoginResponseBody;
    } catch {
      data = null;
    }

    if (!upstream.ok) {
      return NextResponse.json(
        data ?? { error: { code: 'LOGIN_FAILED', message: 'Login failed' } },
        { status: upstream.status },
      );
    }

    const token = data?.token?.trim();
    if (!token) {
      return NextResponse.json(
        { error: { code: 'LOGIN_FAILED', message: 'Login succeeded but no session token was returned.' } },
        { status: 502 },
      );
    }

    const res = NextResponse.json({
      ok: true,
      user: data?.user ?? null,
    });
    res.cookies.set('admin_session', token, {
      path: '/',
      maxAge: ADMIN_SESSION_MAX_AGE_SEC,
      httpOnly: true,
      secure: isHttps(req),
      sameSite: 'lax',
    });
    return res;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'API_UNREACHABLE',
          message: 'Unable to reach the API. Is it running on :4000?',
        },
      },
      { status: 503 },
    );
  }
}
