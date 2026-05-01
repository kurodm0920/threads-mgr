import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const tables = [
  'accounts',
  'scheduled_posts',
  'published_posts',
  'post_metrics',
  'post_features',
  'inspirations',
  'knowledge',
  'daily_account_stats',
  'line_conversions',
  'sessions',
];

console.log('Testing DB connection and table existence...\n');

let allOk = true;
for (const t of tables) {
  const { error } = await supabase.from(t).select('*').limit(1);
  if (error) {
    console.log(`❌ ${t}: ${error.message}`);
    allOk = false;
  } else {
    console.log(`✅ ${t}`);
  }
}

console.log(allOk ? '\n🎉 All tables exist' : '\n💥 Some tables failed');
process.exit(allOk ? 0 : 1);
