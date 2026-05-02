import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const MAX_BATCH = 10;

function checkAuth(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getServiceClient();

  const { data: candidates, error: fetchError } = await supabase
    .from('inspirations')
    .select('id, source_url, scrape_attempts')
    .eq('scrape_status', 'pending')
    .lt('scrape_attempts', 3)
    .order('registered_at', { ascending: true })
    .limit(MAX_BATCH);

  if (fetchError) {
    return NextResponse.json(
      { error: fetchError.message },
      { status: 500 }
    );
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const items: Array<{ id: string; source_url: string }> = [];

  for (const c of candidates) {
    const { data: locked, error } = await supabase
      .from('inspirations')
      .update({
        scrape_status: 'scraping',
        scrape_attempts: c.scrape_attempts + 1,
      })
      .eq('id', c.id)
      .eq('scrape_status', 'pending')
      .select('id, source_url')
      .maybeSingle();

    if (error) continue;
    if (locked) {
      items.push({ id: locked.id, source_url: locked.source_url });
    }
  }

  return NextResponse.json({ items });
}
