import { decryptToken } from '@/lib/crypto';

const THREADS_GRAPH_BASE = 'https://graph.threads.net';

export interface AccountWithToken {
  threads_user_id: string;
  access_token_enc: string;
  access_token_iv: string;
}

function getAccessToken(account: AccountWithToken): string {
  return decryptToken(account.access_token_enc, account.access_token_iv);
}

export async function publishThread(
  account: AccountWithToken,
  body: string
): Promise<{ mediaId: string; permalink: string | null }> {
  const accessToken = getAccessToken(account);

  // Step 1: Create container
  const createUrl = new URL(
    `${THREADS_GRAPH_BASE}/v1.0/${account.threads_user_id}/threads`
  );
  const createBody = new URLSearchParams({
    media_type: 'TEXT',
    text: body,
    access_token: accessToken,
  });

  const createRes = await fetch(createUrl, {
    method: 'POST',
    body: createBody,
  });

  if (!createRes.ok) {
    throw new Error(`Container create failed: ${await createRes.text()}`);
  }

  const createData = (await createRes.json()) as { id: string };
  const creationId = createData.id;

  // Step 2: Publish
  const publishUrl = new URL(
    `${THREADS_GRAPH_BASE}/v1.0/${account.threads_user_id}/threads_publish`
  );
  const publishBody = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });

  const publishRes = await fetch(publishUrl, {
    method: 'POST',
    body: publishBody,
  });

  if (!publishRes.ok) {
    throw new Error(`Publish failed: ${await publishRes.text()}`);
  }

  const publishData = (await publishRes.json()) as { id: string };
  const mediaId = publishData.id;

  // Step 3: Get permalink (best-effort)
  let permalink: string | null = null;
  try {
    const detailsUrl = new URL(`${THREADS_GRAPH_BASE}/v1.0/${mediaId}`);
    detailsUrl.searchParams.set('fields', 'permalink');
    detailsUrl.searchParams.set('access_token', accessToken);

    const detailsRes = await fetch(detailsUrl);
    if (detailsRes.ok) {
      const data = (await detailsRes.json()) as { permalink?: string };
      permalink = data.permalink ?? null;
    }
  } catch {
    // permalink取得失敗は致命的ではない
  }

  return { mediaId, permalink };
}

export interface PostInsights {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  clicks: number;
}

export async function getPostInsights(
  account: AccountWithToken,
  mediaId: string
): Promise<PostInsights> {
  const accessToken = getAccessToken(account);

  const url = new URL(`${THREADS_GRAPH_BASE}/v1.0/${mediaId}/insights`);
  url.searchParams.set('metric', 'views,likes,replies,reposts,quotes,clicks');
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Insights fetch failed: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    data: { name: string; values: { value: number }[] }[];
  };

  const result: PostInsights = {
    views: 0,
    likes: 0,
    replies: 0,
    reposts: 0,
    quotes: 0,
    clicks: 0,
  };

  for (const m of data.data) {
    const v = m.values?.[0]?.value ?? 0;
    switch (m.name) {
      case 'views': result.views = v; break;
      case 'likes': result.likes = v; break;
      case 'replies': result.replies = v; break;
      case 'reposts': result.reposts = v; break;
      case 'quotes': result.quotes = v; break;
      case 'clicks': result.clicks = v; break;
    }
  }

  return result;
}
