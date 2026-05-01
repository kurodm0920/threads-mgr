import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase/server';
import { verifyCcAuth } from '@/lib/auth/cc';

export const dynamic = 'force-dynamic';

const PostInputSchema = z.object({
  scheduled_at: z.string().datetime(),
  body: z.string().min(1).max(500),
  genre: z.enum(['astrology', 'shichu', 'shibun', 'iching', 'general']).optional(),
  content_type: z.enum(['empathy', 'tips', 'fortune', 'story', 'cta']).optional(),
  has_cta: z.boolean().optional(),
  cta_target_url: z.string().url().nullable().optional(),
});

const BodySchema = z.object({
  posts: z.array(PostInputSchema).min(1).max(50),
  generation_batch_id: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  if (!verifyCcAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let parsed;
  try {
    const json = await req.json();
    parsed = BodySchema.parse(json);
  } catch (e) {
    return NextResponse.json(
      { error: 'invalid_body', detail: (e as Error).message },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();

  if (accountError || !account) {
    return NextResponse.json(
      { error: 'no_active_account' },
      { status: 400 }
    );
  }

  const batchId = parsed.generation_batch_id ?? crypto.randomUUID();

  const rows = parsed.posts.map((p) => ({
    account_id: account.id,
    scheduled_at: p.scheduled_at,
    body: p.body,
    genre: p.genre ?? null,
    content_type: p.content_type ?? null,
    has_cta: p.has_cta ?? false,
    cta_target_url: p.cta_target_url ?? null,
    status: 'queued',
    generated_by: 'claude_code',
    generation_batch_id: batchId,
  }));

  const { data, error } = await supabase
    .from('scheduled_posts')
    .insert(rows)
    .select('id, scheduled_at, body');

  if (error) {
    return NextResponse.json(
      { error: 'insert_failed', detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    inserted: data?.length ?? 0,
    batch_id: batchId,
    posts: data,
  });
}
