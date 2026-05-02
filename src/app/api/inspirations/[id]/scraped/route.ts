import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function checkAuth(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

const SuccessSchema = z.object({
  success: z.literal(true),
  body: z.string().min(1),
  account_handle: z.string().optional().nullable(),
  likes_count: z.number().int().nonnegative().optional().nullable(),
  replies_count: z.number().int().nonnegative().optional().nullable(),
  reposts_count: z.number().int().nonnegative().optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
});

const FailSchema = z.object({
  success: z.literal(false),
  error: z.string().min(1),
});

const BodySchema = z.discriminatedUnion('success', [SuccessSchema, FailSchema]);

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await ctx.params;

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

  if (parsed.success) {
    const { error } = await supabase
      .from('inspirations')
      .update({
        scrape_status: 'completed',
        body: parsed.body,
        account_handle: parsed.account_handle ?? null,
        likes_count: parsed.likes_count ?? null,
        replies_count: parsed.replies_count ?? null,
        reposts_count: parsed.reposts_count ?? null,
        published_at: parsed.published_at ?? null,
        scrape_error: null,
      })
      .eq('id', id);
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, id, status: 'completed' });
  }

  const { error } = await supabase
    .from('inspirations')
    .update({
      scrape_status: 'failed',
      scrape_error: parsed.error,
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id, status: 'failed' });
}
