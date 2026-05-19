import Link from 'next/link';
import { getServiceClient } from '@/lib/supabase/server';
import { RegisterForm } from './RegisterForm';
import { InspirationsList } from './InspirationsList';

export const dynamic = 'force-dynamic';

type Tab = 'manual' | 'trend' | 'all';

const TAB_LABEL: Record<Tab, string> = {
  manual: '手動登録',
  trend: 'トレンド',
  all: '全件',
};

function parseTab(v: string | string[] | undefined): Tab {
  if (v === 'trend' || v === 'all') return v;
  return 'manual';
}

export default async function InspirationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const params = await searchParams;
  const tab = parseTab(params.tab);

  const supabase = getServiceClient();
  let query = supabase
    .from('inspirations')
    .select('*')
    .order(tab === 'trend' ? 'discovered_at' : 'registered_at', {
      ascending: false,
      nullsFirst: false,
    })
    .limit(200);

  if (tab === 'manual') {
    query = query.eq('source', 'manual');
  } else if (tab === 'trend') {
    query = query.in('source', ['keyword_trend', 'auto_search']);
  }

  const { data: rows } = await query;

  const counts = await Promise.all([
    supabase
      .from('inspirations')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'manual'),
    supabase
      .from('inspirations')
      .select('id', { count: 'exact', head: true })
      .in('source', ['keyword_trend', 'auto_search']),
    supabase.from('inspirations').select('id', { count: 'exact', head: true }),
  ]);

  const tabCounts: Record<Tab, number> = {
    manual: counts[0].count ?? 0,
    trend: counts[1].count ?? 0,
    all: counts[2].count ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">参考投稿</h1>
        <p className="text-sm text-zinc-500">
          {TAB_LABEL[tab]} {rows?.length ?? 0}件
        </p>
      </div>

      <nav className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
        {(['manual', 'trend', 'all'] as const).map((t) => {
          const active = tab === t;
          return (
            <Link
              key={t}
              href={`/inspirations?tab=${t}`}
              className={`px-3 py-2 text-sm border-b-2 ${
                active
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-medium'
                  : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              }`}
            >
              {TAB_LABEL[t]}{' '}
              <span className="text-xs text-zinc-400">({tabCounts[t]})</span>
            </Link>
          );
        })}
      </nav>

      {tab === 'manual' && (
        <>
          <p className="text-sm text-zinc-500">
            Threads でいいなと思った投稿のURLを貼り付けると、5分以内に GitHub
            Actions が本文・いいね数を自動取得します。連投はツリー登録で。
          </p>
          <RegisterForm />
        </>
      )}

      {tab === 'trend' && (
        <p className="text-sm text-zinc-500">
          占い系キーワードで Playwright が自動収集したトレンド投稿。Claude Code
          で <code className="text-xs">/discover-trends</code>{' '}
          を起動すると新しいバッチを取得します。
        </p>
      )}

      <InspirationsList rows={rows ?? []} showTrendMeta={tab !== 'manual'} />
    </div>
  );
}
