import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { publishThread, type AccountWithToken } from '@/lib/threads/api';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BATCH = 5;
const MAX_ATTEMPTS = 3;

function checkCronAuth(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

interface ScheduledPost {
  id: string;
  account_id: string;
  scheduled_at: string;
  body: string;
  genre: string | null;
  content_type: string | null;
  has_cta: boolean;
  cta_target_url: string | null;
  attempt_count: number;
}

export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data: posts, error: fetchError } = await supabase
    .from('scheduled_posts')
    .select(
      'id, account_id, scheduled_at, body, genre, content_type, has_cta, cta_target_url, attempt_count'
    )
    .eq('status', 'queued')
    .lte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })
    .limit(MAX_BATCH);

  if (fetchError) {
    return NextResponse.json(
      { error: fetchError.message },
      { status: 500 }
    );
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ message: 'no posts to publish', count: 0 });
  }

  const results: Array<{
    id: string;
    status: string;
    error?: string;
    permalink?: string | null;
  }> = [];

  for (const post of posts as ScheduledPost[]) {
    // 楽観ロック
    const { data: locked, error: lockError } = await supabase
      .from('scheduled_posts')
      .update({ status: 'publishing', updated_at: new Date().toISOString() })
      .eq('id', post.id)
      .eq('status', 'queued')
      .select('id')
      .maybeSingle();

    if (lockError || !locked) {
      results.push({
        id: post.id,
        status: 'skip',
        error: lockError?.message ?? 'already taken',
      });
      continue;
    }

    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('threads_user_id, access_token_enc, access_token_iv')
      .eq('id', post.account_id)
      .maybeSingle();

    if (accountError || !account) {
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'failed',
          last_error: `Account fetch error: ${accountError?.message ?? 'not found'}`,
          attempt_count: post.attempt_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);
      results.push({ id: post.id, status: 'account_error' });
      continue;
    }

    try {
      const { mediaId, permalink } = await publishThread(
        account as AccountWithToken,
        post.body
      );

      await supabase.from('published_posts').insert({
        id: post.id,
        account_id: post.account_id,
        threads_media_id: mediaId,
        permalink,
        body_snapshot: post.body,
        genre: post.genre,
        content_type: post.content_type,
        has_cta: post.has_cta,
        cta_target_url: post.cta_target_url,
        scheduled_at: post.scheduled_at,
        published_at: new Date().toISOString(),
      });

      await supabase
        .from('scheduled_posts')
        .update({
          status: 'published',
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);

      results.push({ id: post.id, status: 'published', permalink });
    } catch (e) {
      const errorMsg = (e as Error).message;
      const newAttempt = post.attempt_count + 1;
      const newStatus = newAttempt >= MAX_ATTEMPTS ? 'failed' : 'queued';

      await supabase
        .from('scheduled_posts')
        .update({
          status: newStatus,
          last_error: errorMsg,
          attempt_count: newAttempt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);

      results.push({ id: post.id, status: newStatus, error: errorMsg });
    }
  }

  return NextResponse.json({ count: results.length, results });
}
