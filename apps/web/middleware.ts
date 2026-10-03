import { NextResponse, type NextRequest } from 'next/server';
import { locales } from './lib/i18n';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (locales.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;
  return NextResponse.redirect(new URL(`/fa${pathname}`, req.url));
}

export const config = { matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'] };
