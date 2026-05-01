import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase/server';
import { verifyCcAuth } from '@/lib/auth/cc';

export const dynamic = 'force-dynamic';

const FeatureSchema = z.object({
  body_length: z.number().int().nullable().optional(),
  emoji_count: z.number().int().nullable().optional(),
  hashtag_count: z.number().int().nullable().optional(),
  newline_count: z.number().int().nullable().optional(),
  question_count: z.number().int().nullable().optional(),
  has_cta: z.boolean().nullable().optional(),
  has_url: z.boolean().nullable().optional(),
  cta_position: z.enum(['top', 'middle', 'bottom', 'none']).nullable().optional(),
  keywords_json: z.array(z.string()).nullable().optional(),
  tone: z.enum(['soft', 'firm', 'entertainment']).nullable().optional(),
  decided_by: z.enum(['rule', 'claude_code']).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!verifyCcAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;

  let parsed;
  try {
    const json = await req.json();
    parsed = FeatureSchema.parse(json);
  } catch (e) {
    return NextResponse.json(
      { error: 'invalid_body', detail: (e as Error).message },
      { status: 400 }
    );
  }

  const supabase = getServiceClient();

  const { data: published } = await supabase
    .from('published_posts')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (!published) {
    return NextResponse.json({ error: 'post_not_found' }, { status: 404 });
  }

  const { error } = await supabase.from('post_features').upsert({
    post_id: id,
    ...parsed,
    decided_by: parsed.decided_by ?? 'claude_code',
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json(
      { error: 'upsert_failed', detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, post_id: id });
}
