import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isAuthenticated } from '@/lib/auth/session';
import {
  exchangeShortLivedToken,
  exchangeLongLivedToken,
  getMe,
} from '@/lib/threads/oauth';
import { encryptToken } from '@/lib/crypto';
import { getServiceClient } from '@/lib/supabase/server';

const STATE_COOKIE = 'threads_oauth_state';

function redirectWithError(req: Request, error: string) {
  return NextResponse.redirect(
    new URL(`/settings?oauth_error=${encodeURIComponent(error)}`, req.url)
  );
}

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    return redirectWithError(req, errorDescription ?? error);
  }
  if (!code || !stateParam) {
    return redirectWithError(req, 'missing_params');
  }

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE)?.value;
  if (!stateCookie || stateCookie !== stateParam) {
    return redirectWithError(req, 'state_mismatch');
  }
  cookieStore.delete(STATE_COOKIE);

  try {
    const { accessToken: shortToken } = await exchangeShortLivedToken(code);
    const { accessToken: longToken, expiresIn } =
      await exchangeLongLivedToken(shortToken);
    const me = await getMe(longToken);

    const { enc, iv } = encryptToken(longToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const now = new Date().toISOString();

    const supabase = getServiceClient();
    const { error: dbError } = await supabase.from('accounts').upsert(
      {
        threads_user_id: me.id,
        threads_username: me.username,
        display_name: me.username,
        access_token_enc: enc,
        access_token_iv: iv,
        token_expires_at: expiresAt.toISOString(),
        refreshed_at: now,
        is_active: true,
        updated_at: now,
      },
      { onConflict: 'threads_user_id' }
    );

    if (dbError) {
      throw new Error(`DB error: ${dbError.message}`);
    }

    return NextResponse.redirect(
      new URL('/settings?oauth_success=1', req.url)
    );
  } catch (e) {
    console.error('Threads OAuth callback error:', e);
    return redirectWithError(req, (e as Error).message);
  }
}
