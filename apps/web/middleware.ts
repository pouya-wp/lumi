import { NextResponse, type NextRequest } from 'next/server';
import { locales } from './lib/i18n';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;
  // The bare address opens the app (which sends signed-out people to login); the landing page stays at /fa.
  if (pathname === '/') return NextResponse.redirect(new URL('/fa/app', req.url));
  return NextResponse.redirect(new URL(`/fa${pathname}`, req.url));
}

export const config = { matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'] };
