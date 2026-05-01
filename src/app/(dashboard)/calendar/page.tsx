import Link from 'next/link';
import { getServiceClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const supabase = getServiceClient();

  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: posts } = await supabase
    .from('scheduled_posts')
    .select(
      'id, scheduled_at, body, status, genre, content_type, has_cta, attempt_count'
    )
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .order('scheduled_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">投稿カレンダー</h1>
        <p className="text-sm text-zinc-500">
          過去30日 / 今後30日（{posts?.length ?? 0}件）
        </p>
      </div>

      {posts && posts.length > 0 ? (
        <div className="space-y-2">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/posts/${p.id}`}
              className="block p-4 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 transition-colors"
            >
              <div className="flex items-center justify-between gap-4 mb-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  {p.has_cta && (
                    <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                      CTA
                    </span>
                  )}
                  {p.genre && (
                    <span className="text-xs text-zinc-500">
                      [{p.genre}/{p.content_type ?? '-'}]
                    </span>
                  )}
                </div>
                <time className="text-xs text-zinc-500 font-mono whitespace-nowrap">
                  {new Date(p.scheduled_at).toLocaleString('ja-JP', {
                    timeZone: 'Asia/Tokyo',
                  })}
                </time>
              </div>
              <p className="text-sm line-clamp-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                {p.body}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="p-12 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-center text-sm text-zinc-500">
          まだ投稿がありません。
          <br />
          <code className="text-xs">
            node --env-file=.env.local scripts/seed-test-post.mjs
          </code>{' '}
          でテスト投稿予約できます。
        </div>
      )}
    </div>
  );
}
