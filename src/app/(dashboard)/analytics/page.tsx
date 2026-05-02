import Link from 'next/link';
import { getServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface PostMetrics {
  post_id: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  clicks: number;
}

interface PublishedPost {
  id: string;
  body_snapshot: string;
  genre: string | null;
  content_type: string | null;
  has_cta: boolean;
  published_at: string;
}

const HOUR_BUCKETS = [
  '0-3',
  '3-6',
  '6-9',
  '9-12',
  '12-15',
  '15-18',
  '18-21',
  '21-24',
];

function getHourBucket(hourJst: number): string {
  return HOUR_BUCKETS[Math.floor(hourJst / 3)];
}

function fmtNum(n: number): string {
  return n.toLocaleString('ja-JP');
}

export default async function AnalyticsPage() {
  const supabase = getServiceClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sinceISO = since.toISOString();
  const sinceDate = sinceISO.slice(0, 10);

  const [postsRes, metricsRes, dailyRes, conversionsRes] = await Promise.all([
    supabase
      .from('published_posts')
      .select('id, body_snapshot, genre, content_type, has_cta, published_at')
      .gte('published_at', sinceISO)
      .order('published_at', { ascending: false }),
    supabase
      .from('post_metrics')
      .select('post_id, views, likes, replies, reposts, quotes, clicks')
      .eq('bucket', '24h'),
    supabase
      .from('daily_account_stats')
      .select('*')
      .gte('date', sinceDate)
      .order('date', { ascending: true }),
    supabase.from('line_conversions').select('*').gte('date', sinceDate),
  ]);

  const posts = (postsRes.data ?? []) as PublishedPost[];
  const metricsArr = (metricsRes.data ?? []) as PostMetrics[];
  const metricsMap = new Map(metricsArr.map((m) => [m.post_id, m]));
  const daily = dailyRes.data ?? [];
  const conversions = conversionsRes.data ?? [];

  // === 全体 KPI ===
  let totalViews = 0,
    totalLikes = 0,
    totalClicks = 0;
  for (const p of posts) {
    const m = metricsMap.get(p.id);
    if (!m) continue;
    totalViews += m.views;
    totalLikes += m.likes;
    totalClicks += m.clicks;
  }
  const totalFriends = conversions.reduce(
    (sum, c) => sum + (c.friends_added ?? 0),
    0
  );
  const totalConsult = conversions.reduce(
    (sum, c) => sum + (c.consultations ?? 0),
    0
  );

  // === ジャンル別 ===
  const genreMap = new Map<string, { count: number; views: number; likes: number }>();
  for (const p of posts) {
    const g = p.genre ?? '(未設定)';
    const m = metricsMap.get(p.id);
    if (!genreMap.has(g)) genreMap.set(g, { count: 0, views: 0, likes: 0 });
    const s = genreMap.get(g)!;
    s.count++;
    s.views += m?.views ?? 0;
    s.likes += m?.likes ?? 0;
  }

  // === コンテンツタイプ別 ===
  const typeMap = new Map<string, { count: number; views: number; likes: number }>();
  for (const p of posts) {
    const t = p.content_type ?? '(未設定)';
    const m = metricsMap.get(p.id);
    if (!typeMap.has(t)) typeMap.set(t, { count: 0, views: 0, likes: 0 });
    const s = typeMap.get(t)!;
    s.count++;
    s.views += m?.views ?? 0;
    s.likes += m?.likes ?? 0;
  }

  // === 時間帯別 ===
  const hourMap = new Map<string, { count: number; views: number; likes: number }>();
  for (const p of posts) {
    const d = new Date(p.published_at);
    const jstHour = (d.getUTCHours() + 9) % 24;
    const bucket = getHourBucket(jstHour);
    const m = metricsMap.get(p.id);
    if (!hourMap.has(bucket))
      hourMap.set(bucket, { count: 0, views: 0, likes: 0 });
    const s = hourMap.get(bucket)!;
    s.count++;
    s.views += m?.views ?? 0;
    s.likes += m?.likes ?? 0;
  }

  // === Winners / Losers ===
  const postsWithMetrics = posts
    .map((p) => ({ ...p, metrics: metricsMap.get(p.id) }))
    .filter((p) => p.metrics);

  const sorted = [...postsWithMetrics].sort(
    (a, b) => (b.metrics?.views ?? 0) - (a.metrics?.views ?? 0)
  );
  const top30 = Math.max(1, Math.floor(sorted.length * 0.3));
  const bottom25 = Math.max(1, Math.floor(sorted.length * 0.25));
  const winners = sorted.slice(0, top30);
  const losers = sorted.slice(-bottom25);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">分析（過去30日）</h1>
        <p className="text-sm text-zinc-500">
          投稿{posts.length}件 / メトリクス取得済{metricsArr.length}件
        </p>
      </div>

      {/* KPI */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="投稿数" value={fmtNum(posts.length)} />
        <KpiCard label="総views" value={fmtNum(totalViews)} />
        <KpiCard label="総いいね" value={fmtNum(totalLikes)} />
        <KpiCard label="LINE click" value={fmtNum(totalClicks)} />
        <KpiCard label="友だち追加" value={fmtNum(totalFriends)} />
        <KpiCard label="鑑定依頼" value={fmtNum(totalConsult)} />
      </section>

      {/* ジャンル別 */}
      <Section title="ジャンル別パフォーマンス">
        {genreMap.size > 0 ? (
          <Table
            headers={['ジャンル', '投稿数', '平均views', '平均❤️']}
            rows={[...genreMap.entries()].map(([g, s]) => [
              g,
              fmtNum(s.count),
              fmtNum(Math.round(s.views / s.count)),
              fmtNum(Math.round(s.likes / s.count)),
            ])}
          />
        ) : (
          <Empty />
        )}
      </Section>

      {/* タイプ別 */}
      <Section title="コンテンツタイプ別">
        {typeMap.size > 0 ? (
          <Table
            headers={['タイプ', '投稿数', '平均views', '平均❤️']}
            rows={[...typeMap.entries()].map(([t, s]) => [
              t,
              fmtNum(s.count),
              fmtNum(Math.round(s.views / s.count)),
              fmtNum(Math.round(s.likes / s.count)),
            ])}
          />
        ) : (
          <Empty />
        )}
      </Section>

      {/* 時間帯別 */}
      <Section title="時間帯別（JST、3時間バケット）">
        {hourMap.size > 0 ? (
          <Table
            headers={['時間帯', '投稿数', '平均views', '平均❤️']}
            rows={HOUR_BUCKETS.filter((b) => hourMap.has(b)).map((b) => {
              const s = hourMap.get(b)!;
              return [
                b,
                fmtNum(s.count),
                fmtNum(Math.round(s.views / s.count)),
                fmtNum(Math.round(s.likes / s.count)),
              ];
            })}
          />
        ) : (
          <Empty />
        )}
      </Section>

      {/* Winners */}
      <Section title={`🏆 Winners（24h views 上位30%）`}>
        {winners.length > 0 ? (
          <PostList posts={winners} />
        ) : (
          <Empty />
        )}
      </Section>

      {/* Losers */}
      <Section title={`💔 Losers（24h views 下位25%）`}>
        {losers.length > 0 ? (
          <PostList posts={losers} />
        ) : (
          <Empty />
        )}
      </Section>

      {/* フォロワー推移 */}
      <Section title="フォロワー数推移（直近30日）">
        {daily.length > 0 ? (
          <Table
            headers={['日付', 'フォロワー', '投稿数', 'views', 'clicks']}
            rows={daily
              .slice(-30)
              .reverse()
              .map((d) => [
                d.date,
                fmtNum(d.followers_count ?? 0),
                fmtNum(d.posts_count ?? 0),
                fmtNum(d.total_views ?? 0),
                fmtNum(d.total_clicks ?? 0),
              ])}
          />
        ) : (
          <Empty />
        )}
      </Section>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
      <h2 className="text-sm font-semibold text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

function Empty() {
  return <p className="text-xs text-zinc-500 py-4">データなし</p>;
}

function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
            {headers.map((h, i) => (
              <th
                key={h}
                className={`py-2 px-2 ${i === 0 ? 'text-left' : 'text-right'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className="border-b border-zinc-100 dark:border-zinc-900 last:border-0"
            >
              {r.map((c, j) => (
                <td
                  key={j}
                  className={`py-2 px-2 ${j === 0 ? 'text-left' : 'text-right font-mono'}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PostList({
  posts,
}: {
  posts: Array<{
    id: string;
    body_snapshot: string;
    genre: string | null;
    content_type: string | null;
    metrics?: PostMetrics;
  }>;
}) {
  return (
    <div className="space-y-2">
      {posts.map((p) => (
        <Link
          key={p.id}
          href={`/posts/${p.id}`}
          className="block p-3 bg-zinc-50 dark:bg-zinc-950 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <div className="flex items-center justify-between gap-2 text-xs mb-1">
            <span className="text-zinc-500">
              [{p.genre ?? '-'}/{p.content_type ?? '-'}]
            </span>
            <span className="font-mono text-zinc-500">
              ❤️ {fmtNum(p.metrics?.likes ?? 0)} 👁{' '}
              {fmtNum(p.metrics?.views ?? 0)}
            </span>
          </div>
          <p className="text-sm line-clamp-2 whitespace-pre-wrap">
            {p.body_snapshot}
          </p>
        </Link>
      ))}
    </div>
  );
}
