import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const KEYWORDS = [
  '占い',
  '運勢',
  '星座',
  '開運',
  'スピリチュアル',
  'ホロスコープ',
  'タロット',
  '牡牛座',
  '数秘術',
  '宿命',
];

const RESULTS_PER_KEYWORD = 20;
const THREADS_GRAPH_BASE = 'https://graph.threads.net';

function checkCronAuth(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

interface SearchResult {
  id: string;
  text: string;
  permalink: string;
  username: string;
  timestamp: string;
}

export async function GET(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getServiceClient();

  const { data: account } = await supabase
    .from('accounts')
    .select('threads_username, access_token_enc, access_token_iv')
    .eq('is_active', true)
    .maybeSingle();

  if (!account) {
    return NextResponse.json({ error: 'no_active_account' }, { status: 400 });
  }

  const ownUsername = account.threads_username;
  const accessToken = decryptToken(
    account.access_token_enc,
    account.access_token_iv
  );

  const results: Record<string, { fetched: number; new: number; error?: string }> = {};

  for (const keyword of KEYWORDS) {
    try {
      const url = new URL(`${THREADS_GRAPH_BASE}/v1.0/keyword_search`);
      url.searchParams.set('q', keyword);
      url.searchParams.set('search_type', 'RECENT');
      url.searchParams.set('fields', 'id,text,permalink,username,timestamp');
      url.searchParams.set('access_token', accessToken);

      const res = await fetch(url);
      if (!res.ok) {
        results[keyword] = {
          fetched: 0,
          new: 0,
          error: `HTTP ${res.status}: ${await res.text()}`,
        };
        continue;
      }

      const data = (await res.json()) as { data?: SearchResult[] };
      const allPosts = data.data ?? [];
      // 自分の投稿は除外
      const posts = allPosts
        .filter((p) => p.username !== ownUsername)
        .slice(0, RESULTS_PER_KEYWORD);

      if (posts.length === 0) {
        results[keyword] = { fetched: 0, new: 0 };
        continue;
      }

      const ids = posts.map((p) => p.id);
      const { data: existing } = await supabase
        .from('inspirations')
        .select('threads_post_id')
        .in('threads_post_id', ids)
        .eq('keyword_matched', keyword);

      const existingIds = new Set(
        (existing ?? []).map((e) => e.threads_post_id).filter(Boolean)
      );

      const newRows = posts
        .filter((p) => !existingIds.has(p.id))
        .map((p, i) => ({
          source: 'auto_search',
          source_url: p.permalink,
          threads_post_id: p.id,
          account_handle: p.username,
          body: p.text,
          keyword_matched: keyword,
          popularity_rank: i + 1,
          registered_at: new Date().toISOString(),
        }));

      if (newRows.length > 0) {
        const { error: insertError } = await supabase
          .from('inspirations')
          .insert(newRows);

        if (insertError) {
          results[keyword] = {
            fetched: posts.length,
            new: 0,
            error: `insert: ${insertError.message}`,
          };
          continue;
        }
      }

      results[keyword] = { fetched: posts.length, new: newRows.length };
    } catch (e) {
      results[keyword] = {
        fetched: 0,
        new: 0,
        error: (e as Error).message,
      };
    }
  }

  return NextResponse.json({
    keywords: KEYWORDS.length,
    results,
  });
}
