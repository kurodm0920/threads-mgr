import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type DiscoveredRow = {
  url: string;
  account_handle: string;
  threads_post_id: string;
  rank: number;
  keyword_matched: string;
};

function checkAuth(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

function isValidRow(r: unknown): r is DiscoveredRow {
  if (!r || typeof r !== 'object') return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.url === 'string' &&
    typeof o.account_handle === 'string' &&
    typeof o.threads_post_id === 'string' &&
    typeof o.rank === 'number' &&
    typeof o.keyword_matched === 'string'
  );
}

export async function POST(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const rows = body?.rows;
  if (!Array.isArray(rows)) {
    return NextResponse.json({ error: 'rows must be an array' }, { status: 400 });
  }

  const valid = rows.filter(isValidRow);
  if (valid.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: 0 });
  }

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  // 既存の source_url を一括取得して重複を事前に弾く
  // (migration 0003 の UNIQUE は partial index で upsert の onConflict に
  // 直接渡せないため、アプリ側でフィルタする)
  const urls = valid.map((r) => r.url);
  const { data: existing } = await supabase
    .from('inspirations')
    .select('source_url')
    .in('source_url', urls);

  const existingSet = new Set((existing ?? []).map((e) => e.source_url));
  const toInsert = valid.filter((r) => !existingSet.has(r.url));

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0, skipped: valid.length });
  }

  const payload = toInsert.map((r) => ({
    source: 'keyword_trend' as const,
    source_url: r.url,
    threads_post_id: r.threads_post_id,
    account_handle: r.account_handle,
    keyword_matched: r.keyword_matched,
    search_rank: r.rank,
    discovered_at: now,
    registered_at: now,
    scrape_status: 'pending' as const,
    scrape_attempts: 0,
  }));

  const { data: inserted, error } = await supabase
    .from('inspirations')
    .insert(payload)
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    inserted: inserted?.length ?? 0,
    skipped: valid.length - (inserted?.length ?? 0),
  });
}
