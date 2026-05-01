import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { getPostInsights, type AccountWithToken } from '@/lib/threads/api';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BUCKETS = [
  { name: '1h', minHours: 1 },
  { name: '3h', minHours: 3 },
  { name: '24h', minHours: 24 },
  { name: '3d', minHours: 24 * 3 },
  { name: '7d', minHours: 24 * 7 },
] as const;

function checkCronAuth(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

interface PublishedPost {
  id: string;
  account_id: string;
  threads_media_id: string;
  published_at: string;
}

interface AccountRow {
  id: string;
  threads_user_id: string;
  access_token_enc: string;
  access_token_iv: string;
}

export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getServiceClient();

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: posts, error: fetchError } = await supabase
    .from('published_posts')
    .select('id, account_id, threads_media_id, published_at')
    .gte('published_at', sevenDaysAgo)
    .order('published_at', { ascending: false });

  if (fetchError) {
    return NextResponse.json(
      { error: fetchError.message },
      { status: 500 }
    );
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ message: 'no posts in 7d window', count: 0 });
  }

  const postIds = (posts as PublishedPost[]).map((p) => p.id);
  const { data: existingMetrics } = await supabase
    .from('post_metrics')
    .select('post_id, bucket')
    .in('post_id', postIds);

  const existingSet = new Set(
    (existingMetrics ?? []).map((m) => `${m.post_id}:${m.bucket}`)
  );

  const accountIds = [...new Set((posts as PublishedPost[]).map((p) => p.account_id))];
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, threads_user_id, access_token_enc, access_token_iv')
    .in('id', accountIds);

  const accountMap = new Map<string, AccountRow>(
    (accounts ?? []).map((a) => [a.id, a as AccountRow])
  );

  const now = Date.now();
  const results: Array<{
    post_id: string;
    bucket: string;
    status: string;
    error?: string;
  }> = [];

  for (const post of posts as PublishedPost[]) {
    const account = accountMap.get(post.account_id);
    if (!account) continue;

    const publishedTime = new Date(post.published_at).getTime();
    const hoursAgo = (now - publishedTime) / (1000 * 60 * 60);

    let latestInsights: Awaited<ReturnType<typeof getPostInsights>> | null = null;

    for (const bucket of BUCKETS) {
      if (hoursAgo < bucket.minHours) continue;
      const key = `${post.id}:${bucket.name}`;
      if (existingSet.has(key)) continue;

      try {
        if (!latestInsights) {
          latestInsights = await getPostInsights(
            account as AccountWithToken,
            post.threads_media_id
          );
        }

        const { error: upsertError } = await supabase
          .from('post_metrics')
          .upsert({
            post_id: post.id,
            bucket: bucket.name,
            fetched_at: new Date().toISOString(),
            views: latestInsights.views,
            likes: latestInsights.likes,
            replies: latestInsights.replies,
            reposts: latestInsights.reposts,
            quotes: latestInsights.quotes,
            clicks: latestInsights.clicks,
          });

        if (upsertError) throw new Error(upsertError.message);

        results.push({
          post_id: post.id,
          bucket: bucket.name,
          status: 'fetched',
        });
      } catch (e) {
        results.push({
          post_id: post.id,
          bucket: bucket.name,
          status: 'error',
          error: (e as Error).message,
        });
      }
    }

    try {
      if (!latestInsights) {
        latestInsights = await getPostInsights(
          account as AccountWithToken,
          post.threads_media_id
        );
      }
      await supabase.from('post_metrics').upsert({
        post_id: post.id,
        bucket: 'latest',
        fetched_at: new Date().toISOString(),
        views: latestInsights.views,
        likes: latestInsights.likes,
        replies: latestInsights.replies,
        reposts: latestInsights.reposts,
        quotes: latestInsights.quotes,
        clicks: latestInsights.clicks,
      });
    } catch {
      // latest 更新失敗は無視
    }
  }

  return NextResponse.json({ count: results.length, results });
}
