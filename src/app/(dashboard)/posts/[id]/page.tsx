import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServiceClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = getServiceClient();

  const { data: scheduled } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!scheduled) notFound();

  const { data: published } = await supabase
    .from('published_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const { data: metrics } = await supabase
    .from('post_metrics')
    .select('*')
    .eq('post_id', id)
    .order('bucket', { ascending: true });

  return (
    <div className="space-y-6">
      <Link
        href="/calendar"
        className="inline-block text-sm text-blue-500 hover:underline"
      >
        ← カレンダーに戻る
      </Link>

      <h1 className="text-2xl font-bold">投稿詳細</h1>

      {/* 本文 */}
      <section className="bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-500">本文</h2>
          <StatusBadge status={scheduled.status} />
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {published?.body_snapshot ?? scheduled.body}
        </p>
        {published?.permalink && (
          <a
            href={published.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm text-blue-500 hover:underline"
          >
            Threadsで見る →
          </a>
        )}
      </section>

      {/* メタ情報 */}
      <section className="bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-sm font-semibold text-zinc-500 mb-3">メタ情報</h2>
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-zinc-500">予約時刻</dt>
          <dd className="font-mono">
            {new Date(scheduled.scheduled_at).toLocaleString('ja-JP', {
              timeZone: 'Asia/Tokyo',
            })}
          </dd>
          {published?.published_at && (
            <>
              <dt className="text-zinc-500">投稿時刻</dt>
              <dd className="font-mono">
                {new Date(published.published_at).toLocaleString('ja-JP', {
                  timeZone: 'Asia/Tokyo',
                })}
              </dd>
            </>
          )}
          <dt className="text-zinc-500">ジャンル</dt>
          <dd>{scheduled.genre ?? '-'}</dd>
          <dt className="text-zinc-500">タイプ</dt>
          <dd>{scheduled.content_type ?? '-'}</dd>
          <dt className="text-zinc-500">CTA</dt>
          <dd>{scheduled.has_cta ? 'あり' : 'なし'}</dd>
          <dt className="text-zinc-500">生成元</dt>
          <dd>{scheduled.generated_by ?? '-'}</dd>
          <dt className="text-zinc-500">attempts</dt>
          <dd>{scheduled.attempt_count}</dd>
          {scheduled.last_error && (
            <>
              <dt className="text-zinc-500">最終エラー</dt>
              <dd className="text-red-500 break-all text-xs">
                {scheduled.last_error}
              </dd>
            </>
          )}
        </dl>
      </section>

      {/* メトリクス */}
      {published && (
        <section className="bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-zinc-500">メトリクス推移</h2>
          {metrics && metrics.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left py-2 px-2">バケット</th>
                    <th className="text-right py-2 px-2">views</th>
                    <th className="text-right py-2 px-2">❤️</th>
                    <th className="text-right py-2 px-2">💬</th>
                    <th className="text-right py-2 px-2">🔄</th>
                    <th className="text-right py-2 px-2">quotes</th>
                    <th className="text-right py-2 px-2">clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr
                      key={`${m.post_id}-${m.bucket}`}
                      className="border-b border-zinc-100 dark:border-zinc-900 last:border-0"
                    >
                      <td className="py-2 px-2 font-mono">{m.bucket}</td>
                      <td className="text-right py-2 px-2 font-mono">{m.views}</td>
                      <td className="text-right py-2 px-2 font-mono">{m.likes}</td>
                      <td className="text-right py-2 px-2 font-mono">{m.replies}</td>
                      <td className="text-right py-2 px-2 font-mono">{m.reposts}</td>
                      <td className="text-right py-2 px-2 font-mono">{m.quotes}</td>
                      <td className="text-right py-2 px-2 font-mono">{m.clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              メトリクス未取得（投稿後1時間以降に取得開始）
            </p>
          )}
        </section>
      )}
    </div>
  );
}
