import { getServiceClient } from '@/lib/supabase/server';
import { RegisterForm } from './RegisterForm';
import { InspirationsList } from './InspirationsList';

export const dynamic = 'force-dynamic';

export default async function InspirationsPage() {
  const supabase = getServiceClient();
  const { data: rows } = await supabase
    .from('inspirations')
    .select('*')
    .order('registered_at', { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">参考投稿</h1>
        <p className="text-sm text-zinc-500">
          全{rows?.length ?? 0}件
        </p>
      </div>

      <p className="text-sm text-zinc-500">
        Threads でいいなと思った投稿のURLを貼り付けると、5分以内に GitHub Actions
        が本文・いいね数を自動取得します。連投はツリー登録で。
      </p>

      <RegisterForm />

      <InspirationsList rows={rows ?? []} />
    </div>
  );
}
