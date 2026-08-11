import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4000';

/** Create cart — POST /api/cart → POST /api/v1/carts */
export async function POST(req: Request) {
  try {
    const body = await req.text();
    const upstream = await fetch(`${API_URL}/api/v1/carts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
    });
    const text = await upstream.text();
    const res = new NextResponse(text, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
      },
    });

    if (upstream.ok) {
      try {
        const parsed = JSON.parse(text) as { token?: string };
        if (parsed.token) {
          res.cookies.set('cart_token', parsed.token, {
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
            sameSite: 'lax',
            httpOnly: false,
          });
        }
      } catch {
        /* ignore parse errors */
      }
    }

    return res;
  } catch {
    return NextResponse.json(
      { error: { message: 'Cart service unreachable. Please try again.' } },
      { status: 503 },
    );
  }
}

/** Current cart — GET /api/cart → GET /api/v1/carts/current */
export async function GET(req: Request) {
  const headerToken = req.headers.get('x-cart-token');
  const cookieToken = cookies().get('cart_token')?.value;
  const token = headerToken || (cookieToken ? decodeURIComponent(cookieToken) : null);
  if (!token) {
    return NextResponse.json({ error: { message: 'Cart not found.' } }, { status: 404 });
  }

  try {
    const upstream = await fetch(`${API_URL}/api/v1/carts/current`, {
      headers: { 'x-cart-token': token },
      cache: 'no-store',
    });
    const text = await upstream.text();
    const res = new NextResponse(text, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
      },
    });
    if (upstream.status === 404 || upstream.status === 409 || upstream.status === 410) {
      res.cookies.set('cart_token', '', { path: '/', maxAge: 0 });
    }
    return res;
  } catch {
    return NextResponse.json(
      { error: { message: 'Cart service unreachable. Please try again.' } },
      { status: 503 },
    );
  }
}
