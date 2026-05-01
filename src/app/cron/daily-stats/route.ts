import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const THREADS_GRAPH_BASE = 'https://graph.threads.net';

function checkCronAuth(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

async function fetchFollowersCount(
  userId: string,
  accessToken: string
): Promise<number | null> {
  try {
    const url = new URL(`${THREADS_GRAPH_BASE}/v1.0/${userId}/threads_insights`);
    url.searchParams.set('metric', 'followers_count');
    url.searchParams.set('access_token', accessToken);

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      data?: Array<{ name: string; total_value?: { value: number }; values?: { value: number }[] }>;
    };

    const item = data.data?.find((d) => d.name === 'followers_count');
    return item?.total_value?.value ?? item?.values?.[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getServiceClient();

  const { data: account } = await supabase
    .from('accounts')
    .select('id, threads_user_id, access_token_enc, access_token_iv')
    .eq('is_active', true)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: 'no_account' }, { status: 400 });
  }

  const accessToken = decryptToken(
    account.access_token_enc,
    account.access_token_iv
  );

  // 前日 (JST) を計算
  const now = new Date();
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  const jstNow = new Date(now.getTime() + jstOffsetMs);
  const jstYesterday = new Date(jstNow.getTime() - 24 * 60 * 60 * 1000);
  const dateStr = jstYesterday.toISOString().split('T')[0];

  const yesterdayStartUTC = new Date(`${dateStr}T00:00:00+09:00`).toISOString();
  const yesterdayEndUTC = new Date(`${dateStr}T23:59:59.999+09:00`).toISOString();

  // フォロワー数取得
  const followersCount = await fetchFollowersCount(
    account.threads_user_id,
    accessToken
  );

  // 前日の published_posts を集計
  const { data: postsYesterday } = await supabase
    .from('published_posts')
    .select('id')
    .eq('account_id', account.id)
    .gte('published_at', yesterdayStartUTC)
    .lte('published_at', yesterdayEndUTC);

  const totals = { views: 0, likes: 0, replies: 0, clicks: 0 };
  if (postsYesterday && postsYesterday.length > 0) {
    const ids = postsYesterday.map((p) => p.id);
    const { data: metrics } = await supabase
      .from('post_metrics')
      .select('views, likes, replies, clicks')
      .in('post_id', ids)
      .eq('bucket', '24h');

    for (const m of metrics ?? []) {
      totals.views += m.views ?? 0;
      totals.likes += m.likes ?? 0;
      totals.replies += m.replies ?? 0;
      totals.clicks += m.clicks ?? 0;
    }
  }

  const { error } = await supabase.from('daily_account_stats').upsert({
    account_id: account.id,
    date: dateStr,
    followers_count: followersCount,
    posts_count: postsYesterday?.length ?? 0,
    total_views: totals.views,
    total_likes: totals.likes,
    total_replies: totals.replies,
    total_clicks: totals.clicks,
  });

  if (error) {
    return NextResponse.json(
      { error: 'upsert_failed', detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    date: dateStr,
    followers_count: followersCount,
    posts_count: postsYesterday?.length ?? 0,
    totals,
  });
}
