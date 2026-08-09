import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BRANCH_COOKIE = 'preferred_branch';

const PUBLIC_PREFIXES = [
  '/select-location',
  '/privacy',
  '/terms',
  '/returns',
  '/faq',
  '/contact',
  '/_next',
  '/favicon',
];

const PUBLIC_EXACT = new Set(['/robots.txt', '/sitemap.xml']);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const branch = request.cookies.get(BRANCH_COOKIE)?.value;
  if (branch) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/select-location';
  const next = `${pathname}${request.nextUrl.search}`;
  if (next && next !== '/') {
    url.searchParams.set('next', next);
  }
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
