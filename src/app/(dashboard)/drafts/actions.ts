'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase/server';

const UpdateSchema = z.object({
  id: z.string().uuid(),
  body: z.string().min(1).max(2000),
  scheduled_at: z.string().datetime(),
});

export async function updateDraft(formData: FormData): Promise<void> {
  const parsed = UpdateSchema.parse({
    id: formData.get('id')?.toString(),
    body: formData.get('body')?.toString(),
    scheduled_at: formData.get('scheduled_at')?.toString(),
  });

  const supabase = getServiceClient();
  const { error } = await supabase
    .from('scheduled_posts')
    .update({
      body: parsed.body,
      scheduled_at: parsed.scheduled_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parsed.id)
    .eq('status', 'queued');

  if (error) throw new Error(`Update failed: ${error.message}`);

  revalidatePath('/drafts');
  revalidatePath('/calendar');
}

export async function cancelDraft(id: string): Promise<void> {
  const supabase = getServiceClient();
  await supabase
    .from('scheduled_posts')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'queued');

  revalidatePath('/drafts');
  revalidatePath('/calendar');
}

export async function shiftDraft(id: string, hours: number): Promise<void> {
  const supabase = getServiceClient();
  const { data: row } = await supabase
    .from('scheduled_posts')
    .select('scheduled_at')
    .eq('id', id)
    .eq('status', 'queued')
    .maybeSingle();

  if (!row) return;

  const newAt = new Date(
    new Date(row.scheduled_at).getTime() + hours * 60 * 60 * 1000
  ).toISOString();

  await supabase
    .from('scheduled_posts')
    .update({ scheduled_at: newAt, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'queued');

  revalidatePath('/drafts');
  revalidatePath('/calendar');
}
