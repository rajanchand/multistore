import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:4000';

type RouteContext = { params: { path?: string[] } };

async function proxy(req: Request, context: RouteContext) {
  const segments = context.params.path ?? [];
  const upstreamPath = segments.length ? segments.join('/') : '';
  const url = new URL(req.url);
  const target = `${API_URL}/api/v1/carts${upstreamPath ? `/${upstreamPath}` : ''}${url.search}`;

  const cookieToken = cookies().get('cart_token')?.value;
  const headerToken = req.headers.get('x-cart-token');
  const token = headerToken || (cookieToken ? decodeURIComponent(cookieToken) : null);

  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  if (token) headers.set('x-cart-token', token);

  const init: RequestInit = {
    method: req.method,
    headers,
    cache: 'no-store',
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch {
    return NextResponse.json(
      { error: { message: 'Cart service unreachable. Please try again.' } },
      { status: 503 },
    );
  }
}

export async function GET(req: Request, context: RouteContext) {
  return proxy(req, context);
}

export async function POST(req: Request, context: RouteContext) {
  return proxy(req, context);
}

export async function PATCH(req: Request, context: RouteContext) {
  return proxy(req, context);
}

export async function DELETE(req: Request, context: RouteContext) {
  return proxy(req, context);
}
