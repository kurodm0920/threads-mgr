import { NextResponse } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { getServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function checkAuth(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}

const TreeChildSchema = z.object({
  threads_post_id: z.string().min(1),
  source_url: z.string().url(),
  body: z.string().min(1),
  published_at: z.string().datetime().optional().nullable(),
  image_count: z.number().int().nonnegative().optional(),
  has_video: z.boolean().optional(),
});

const SuccessSchema = z.object({
  success: z.literal(true),
  body: z.string().min(1),
  account_handle: z.string().optional().nullable(),
  likes_count: z.number().int().nonnegative().optional().nullable(),
  replies_count: z.number().int().nonnegative().optional().nullable(),
  reposts_count: z.number().int().nonnegative().optional().nullable(),
  views_count: z.number().int().nonnegative().optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
  image_count: z.number().int().nonnegative().optional(),
  has_image: z.boolean().optional(),
  has_video: z.boolean().optional(),
  tree_children: z.array(TreeChildSchema).optional(),
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
    // 既存の親情報を取得（tree_id 確認）
    const { data: parentRow } = await supabase
      .from('inspirations')
      .select('id, tree_id, source, keyword_matched, discovered_at, registered_at')
      .eq('id', id)
      .maybeSingle();

    // 連投自動検出は keyword_trend / auto_search のみ。
    // manual はゆやさんが意図して登録した URL なので、隣接記事を勝手にツリー化しない。
    const allowTreeExpansion =
      parentRow?.source === 'keyword_trend' || parentRow?.source === 'auto_search';
    const children = allowTreeExpansion ? (parsed.tree_children ?? []) : [];
    const parentTreeId =
      children.length > 0 ? (parentRow?.tree_id ?? randomUUID()) : (parentRow?.tree_id ?? null);

    const { error } = await supabase
      .from('inspirations')
      .update({
        scrape_status: 'completed',
        body: parsed.body,
        account_handle: parsed.account_handle ?? null,
        likes_count: parsed.likes_count ?? null,
        replies_count: parsed.replies_count ?? null,
        reposts_count: parsed.reposts_count ?? null,
        views_count: parsed.views_count ?? null,
        published_at: parsed.published_at ?? null,
        image_count: parsed.image_count ?? null,
        has_image: parsed.has_image ?? null,
        has_video: parsed.has_video ?? null,
        scrape_error: null,
        ...(children.length > 0
          ? { tree_id: parentTreeId, tree_position: 1 }
          : {}),
      })
      .eq('id', id);
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // ツリー子を upsert（source_url の partial unique index に従う）
    let insertedChildren = 0;
    if (children.length > 0 && parentTreeId) {
      // 既存の同 URL を取得して、新規分だけ INSERT
      const childUrls = children.map((c) => c.source_url);
      const { data: existingChildren } = await supabase
        .from('inspirations')
        .select('source_url, id, tree_id')
        .in('source_url', childUrls);
      const existingMap = new Map(
        (existingChildren ?? []).map((r) => [r.source_url, r])
      );

      const now = new Date().toISOString();
      const toInsert: Array<Record<string, unknown>> = [];
      for (let i = 0; i < children.length; i++) {
        const c = children[i];
        if (existingMap.has(c.source_url)) {
          // 既存行があれば tree_id / tree_position を補正
          await supabase
            .from('inspirations')
            .update({
              tree_id: parentTreeId,
              tree_position: i + 2,
              ...(c.body ? { body: c.body } : {}),
              ...(c.published_at ? { published_at: c.published_at } : {}),
            })
            .eq('source_url', c.source_url);
          continue;
        }
        toInsert.push({
          source: parentRow?.source ?? 'keyword_trend',
          source_url: c.source_url,
          threads_post_id: c.threads_post_id,
          account_handle: parsed.account_handle ?? null,
          body: c.body,
          published_at: c.published_at ?? null,
          image_count: c.image_count ?? null,
          has_image: c.image_count != null ? c.image_count > 0 : null,
          has_video: c.has_video ?? null,
          tree_id: parentTreeId,
          tree_position: i + 2,
          scrape_status: 'completed',
          scrape_attempts: 1,
          keyword_matched: parentRow?.keyword_matched ?? null,
          discovered_at: parentRow?.discovered_at ?? now,
          registered_at: now,
        });
      }
      if (toInsert.length > 0) {
        const { data: insRows } = await supabase
          .from('inspirations')
          .insert(toInsert)
          .select('id');
        insertedChildren = insRows?.length ?? 0;
      }
    }

    return NextResponse.json({
      ok: true,
      id,
      status: 'completed',
      tree_children_inserted: insertedChildren,
      tree_id: parentTreeId,
    });
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
