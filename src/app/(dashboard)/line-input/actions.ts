'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabase/server';

const Schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  friends_added: z.number().int().min(0),
  consultations: z.number().int().min(0),
  notes: z.string().optional(),
});

export async function saveLineConversion(formData: FormData): Promise<void> {
  const parsed = Schema.parse({
    date: formData.get('date')?.toString(),
    friends_added: parseInt(
      formData.get('friends_added')?.toString() ?? '0',
      10
    ),
    consultations: parseInt(
      formData.get('consultations')?.toString() ?? '0',
      10
    ),
    notes: formData.get('notes')?.toString() || undefined,
  });

  const supabase = getServiceClient();

  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();

  if (!account) {
    throw new Error('No active account. Connect Threads via /settings first.');
  }

  const { error } = await supabase.from('line_conversions').upsert({
    account_id: account.id,
    date: parsed.date,
    friends_added: parsed.friends_added,
    consultations: parsed.consultations,
    notes: parsed.notes ?? null,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to save: ${error.message}`);
  }

  redirect('/line-input?saved=1');
}
