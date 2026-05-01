const THREADS_AUTHORIZE_URL = 'https://threads.net/oauth/authorize';
const THREADS_GRAPH_BASE = 'https://graph.threads.net';

const SCOPES = [
  'threads_basic',
  'threads_content_publish',
  'threads_manage_insights',
  'threads_keyword_search',
].join(',');

function getEnv() {
  const appId = process.env.THREADS_APP_ID;
  const appSecret = process.env.THREADS_APP_SECRET;
  const redirectUri = process.env.THREADS_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    throw new Error(
      'Threads env vars not set: THREADS_APP_ID / THREADS_APP_SECRET / THREADS_REDIRECT_URI'
    );
  }
  return { appId, appSecret, redirectUri };
}

export function buildAuthorizeUrl(state: string): string {
  const { appId, redirectUri } = getEnv();
  const url = new URL(THREADS_AUTHORIZE_URL);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeShortLivedToken(code: string): Promise<{
  accessToken: string;
  userId: string;
}> {
  const { appId, appSecret, redirectUri } = getEnv();

  const body = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch(`${THREADS_GRAPH_BASE}/oauth/access_token`, {
    method: 'POST',
    body,
  });

  if (!res.ok) {
    throw new Error(`Short-lived token exchange failed: ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; user_id: number | string };
  return {
    accessToken: data.access_token,
    userId: String(data.user_id),
  };
}

export async function exchangeLongLivedToken(shortLivedToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const { appSecret } = getEnv();

  const url = new URL(`${THREADS_GRAPH_BASE}/access_token`);
  url.searchParams.set('grant_type', 'th_exchange_token');
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('access_token', shortLivedToken);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Long-lived token exchange failed: ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

export async function getMe(accessToken: string): Promise<{
  id: string;
  username: string;
}> {
  const url = new URL(`${THREADS_GRAPH_BASE}/v1.0/me`);
  url.searchParams.set('fields', 'id,username');
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch /me: ${await res.text()}`);
  }
  return (await res.json()) as { id: string; username: string };
}
