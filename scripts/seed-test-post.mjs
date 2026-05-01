import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: account, error: accountError } = await supabase
  .from('accounts')
  .select('id, threads_username')
  .eq('is_active', true)
  .maybeSingle();

if (accountError || !account) {
  console.error('No active account found. Connect Threads via /settings first.');
  process.exit(1);
}

const body =
  process.argv[2] ??
  `テスト投稿 ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`;

const { data, error } = await supabase
  .from('scheduled_posts')
  .insert({
    account_id: account.id,
    scheduled_at: new Date().toISOString(),
    body,
    genre: 'general',
    content_type: 'tips',
    generated_by: 'manual',
    status: 'queued',
  })
  .select()
  .single();

if (error) {
  console.error('Insert error:', error.message);
  process.exit(1);
}

console.log('✅ Scheduled post created');
console.log('   account: @' + account.threads_username);
console.log('   id:     ', data.id);
console.log('   body:   ', data.body);
console.log('   time:   ', data.scheduled_at);
console.log('');
console.log('To trigger publish, run:');
console.log(
  `  curl -k -H "Authorization: Bearer $CRON_SECRET" https://localhost:3001/cron/publish`
);
