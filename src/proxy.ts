import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'threads_mgr_session';

const PROTECTED_PREFIXES = [
  '/calendar',
  '/posts',
  '/analytics',
  '/drafts',
  '/inspirations',
  '/line-input',
  '/settings',
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (!isProtected) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
