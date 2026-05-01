import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { isAuthenticated } from '@/lib/auth/session';
import { buildAuthorizeUrl } from '@/lib/threads/oauth';

const STATE_COOKIE = 'threads_oauth_state';

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const state = crypto.randomBytes(32).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60,
  });

  const authUrl = buildAuthorizeUrl(state);
  return NextResponse.redirect(authUrl);
}
