import { getServiceClient } from '@/lib/supabase/server';
import { DraftRow } from './DraftRow';

export const dynamic = 'force-dynamic';

export default async function DraftsPage() {
  const supabase = getServiceClient();
  const { data: drafts } = await supabase
    .from('scheduled_posts')
    .select('id, scheduled_at, body, genre, content_type, has_cta')
    .eq('status', 'queued')
    .order('scheduled_at', { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">下書き編集</h1>
        <p className="text-sm text-zinc-500">
          予約済み（queued）{drafts?.length ?? 0}件
        </p>
      </div>

      <p className="text-sm text-zinc-500">
        本文・時刻の編集、キャンセル、時刻シフト（-1h / +1h / +1日）ができます。
      </p>

      {drafts && drafts.length > 0 ? (
        <div className="space-y-3">
          {drafts.map((d) => (
            <DraftRow key={d.id} row={d} />
          ))}
        </div>
      ) : (
        <div className="p-12 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-center text-sm text-zinc-500">
          予約済みの投稿はありません。
          <br />
          Claude Code の <code>/today-rest</code> /{' '}
          <code>/tomorrow-morning</code> で生成できます。
        </div>
      )}
    </div>
  );
}
