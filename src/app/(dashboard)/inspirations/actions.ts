'use server';

import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase/server';

const ThreadsUrlSchema = z
  .string()
  .url()
  .refine((u) => /^https?:\/\/(www\.)?threads\.(net|com)\//.test(u), {
    message: 'Threads の投稿URLを入れてください',
  });

const SingleSchema = z.object({
  url: ThreadsUrlSchema,
  my_notes: z.string().max(500).optional(),
});

const TreeSchema = z.object({
  urls: z.array(ThreadsUrlSchema).min(2).max(20),
  my_notes: z.string().max(500).optional(),
});

export async function registerSingleInspiration(
  formData: FormData
): Promise<void> {
  const parsed = SingleSchema.parse({
    url: formData.get('url')?.toString() ?? '',
    my_notes: formData.get('my_notes')?.toString() || undefined,
  });

  const supabase = getServiceClient();
  const { error } = await supabase.from('inspirations').insert({
    source: 'manual',
    source_url: parsed.url,
    my_notes: parsed.my_notes ?? null,
    scrape_status: 'pending',
    registered_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Insert failed: ${error.message}`);
  }

  revalidatePath('/inspirations');
}

export async function registerTreeInspiration(
  formData: FormData
): Promise<void> {
  const rawUrls = formData.getAll('urls').map((u) => u.toString().trim()).filter(Boolean);
  const parsed = TreeSchema.parse({
    urls: rawUrls,
    my_notes: formData.get('my_notes')?.toString() || undefined,
  });

  const treeId = crypto.randomUUID();
  const now = new Date().toISOString();

  const rows = parsed.urls.map((url, i) => ({
    source: 'manual',
    source_url: url,
    tree_id: treeId,
    tree_position: i + 1,
    my_notes: i === 0 ? parsed.my_notes ?? null : null,
    scrape_status: 'pending',
    registered_at: now,
  }));

  const supabase = getServiceClient();
  const { error } = await supabase.from('inspirations').insert(rows);

  if (error) {
    throw new Error(`Tree insert failed: ${error.message}`);
  }

  revalidatePath('/inspirations');
}

export async function retryInspiration(id: string): Promise<void> {
  const supabase = getServiceClient();
  await supabase
    .from('inspirations')
    .update({
      scrape_status: 'pending',
      scrape_error: null,
    })
    .eq('id', id);
  revalidatePath('/inspirations');
}

export async function deleteInspiration(id: string): Promise<void> {
  const supabase = getServiceClient();
  await supabase.from('inspirations').delete().eq('id', id);
  revalidatePath('/inspirations');
}
