import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { verifyCcAuth } from '@/lib/auth/cc';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!verifyCcAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const days = Math.min(
    Math.max(parseInt(url.searchParams.get('days') ?? '7', 10), 1),
    90
  );

  const supabase = getServiceClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [publishedRes, metricsRes, featuresRes, inspirationsRes, knowledgeRes] =
    await Promise.all([
      supabase
        .from('published_posts')
        .select(
          'id, body_snapshot, genre, content_type, has_cta, cta_target_url, scheduled_at, published_at, permalink'
        )
        .gte('published_at', since)
        .order('published_at', { ascending: false }),
      supabase
        .from('post_metrics')
        .select('post_id, bucket, fetched_at, views, likes, replies, reposts, quotes, clicks')
        .gte('fetched_at', since),
      supabase
        .from('post_features')
        .select('*')
        .order('updated_at', { ascending: false }),
      supabase
        .from('inspirations')
        .select('*')
        .gte('registered_at', since)
        .order('registered_at', { ascending: false }),
      supabase
        .from('knowledge')
        .select('*')
        .order('derived_at', { ascending: false })
        .limit(3),
    ]);

  return NextResponse.json({
    range_days: days,
    since,
    published_posts: publishedRes.data ?? [],
    post_metrics: metricsRes.data ?? [],
    post_features: featuresRes.data ?? [],
    inspirations: inspirationsRes.data ?? [],
    recent_knowledge: knowledgeRes.data ?? [],
  });
}
