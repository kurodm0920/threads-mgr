import { retryInspiration, deleteInspiration } from './actions';

interface Inspiration {
  id: string;
  source: string;
  source_url: string;
  account_handle: string | null;
  body: string | null;
  my_notes: string | null;
  registered_at: string;
  tree_id: string | null;
  tree_position: number | null;
  scrape_status: string;
  scrape_error: string | null;
  scrape_attempts: number;
  likes_count: number | null;
  replies_count: number | null;
  reposts_count: number | null;
  published_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: {
    label: '取得待ち',
    color: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  },
  scraping: {
    label: '取得中...',
    color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  },
  completed: {
    label: '取得済み',
    color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  },
  failed: {
    label: '取得失敗',
    color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  },
};

function StatusBadge({ status }: { status: string }) {
  const c =
    STATUS_CONFIG[status] ?? { label: status, color: 'bg-zinc-100 text-zinc-700' };
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${c.color}`}>{c.label}</span>
  );
}

export function InspirationsList({ rows }: { rows: Inspiration[] }) {
  // ツリーごとにグループ化
  const groups = new Map<string, Inspiration[]>();
  const singles: Inspiration[] = [];

  for (const r of rows) {
    if (r.tree_id) {
      if (!groups.has(r.tree_id)) groups.set(r.tree_id, []);
      groups.get(r.tree_id)!.push(r);
    } else {
      singles.push(r);
    }
  }

  // tree_id ごとに position 順
  for (const [, list] of groups) {
    list.sort((a, b) => (a.tree_position ?? 0) - (b.tree_position ?? 0));
  }

  // 表示用にグループも単発も時系列で混ぜる（最も新しい registered_at で判断）
  const sections: Array<
    { type: 'single'; row: Inspiration } | { type: 'tree'; rows: Inspiration[] }
  > = [];

  for (const r of singles) sections.push({ type: 'single', row: r });
  for (const [, list] of groups) sections.push({ type: 'tree', rows: list });

  sections.sort((a, b) => {
    const ta = a.type === 'single' ? a.row.registered_at : a.rows[0].registered_at;
    const tb = b.type === 'single' ? b.row.registered_at : b.rows[0].registered_at;
    return tb.localeCompare(ta);
  });

  if (sections.length === 0) {
    return (
      <section className="p-12 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-center text-sm text-zinc-500">
        まだ参考投稿がありません。上のフォームからURL登録してください。
      </section>
    );
  }

  return (
    <section className="space-y-3">
      {sections.map((s) => {
        if (s.type === 'tree') {
          return <TreeCard key={`tree-${s.rows[0].tree_id}`} rows={s.rows} />;
        }
        return <SingleCard key={s.row.id} row={s.row} />;
      })}
    </section>
  );
}

function SingleCard({ row }: { row: Inspiration }) {
  return (
    <article className="bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
      <Header row={row} />
      <Body row={row} />
      {row.my_notes && (
        <p className="text-xs text-zinc-500 italic">📝 {row.my_notes}</p>
      )}
      <Actions row={row} />
    </article>
  );
}

function TreeCard({ rows }: { rows: Inspiration[] }) {
  return (
    <article className="bg-white dark:bg-zinc-900 rounded border-2 border-blue-300 dark:border-blue-800 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          ツリー（{rows.length}投稿）
        </span>
        <time className="text-xs text-zinc-500">
          {new Date(rows[0].registered_at).toLocaleString('ja-JP', {
            timeZone: 'Asia/Tokyo',
          })}
        </time>
      </div>
      {rows[0].my_notes && (
        <p className="text-xs text-zinc-500 italic">📝 {rows[0].my_notes}</p>
      )}
      <div className="space-y-2 pl-3 border-l-2 border-blue-200 dark:border-blue-900">
        {rows.map((r) => (
          <div key={r.id} className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-500">#{r.tree_position}</span>
              <StatusBadge status={r.scrape_status} />
              {r.account_handle && (
                <span className="font-mono text-zinc-500">
                  @{r.account_handle}
                </span>
              )}
            </div>
            <Body row={r} />
            <Actions row={r} compact />
          </div>
        ))}
      </div>
    </article>
  );
}

function Header({ row }: { row: Inspiration }) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2 text-xs">
        <StatusBadge status={row.scrape_status} />
        {row.account_handle && (
          <a
            href={row.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-blue-500 hover:underline"
          >
            @{row.account_handle}
          </a>
        )}
        {row.likes_count !== null && (
          <span className="text-zinc-500">
            ❤️ {row.likes_count} 💬 {row.replies_count ?? 0} 🔄{' '}
            {row.reposts_count ?? 0}
          </span>
        )}
      </div>
      <time className="text-xs text-zinc-500">
        {new Date(row.registered_at).toLocaleString('ja-JP', {
          timeZone: 'Asia/Tokyo',
        })}
      </time>
    </div>
  );
}

function Body({ row }: { row: Inspiration }) {
  if (row.scrape_status === 'completed' && row.body) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {row.body}
      </p>
    );
  }
  if (row.scrape_status === 'failed') {
    return (
      <p className="text-xs text-red-500">
        ⚠ {row.scrape_error ?? '取得失敗'}
        （{row.scrape_attempts}回試行）
      </p>
    );
  }
  return (
    <p className="text-xs text-zinc-500 font-mono break-all">
      {row.source_url}
    </p>
  );
}

function Actions({
  row,
  compact = false,
}: {
  row: Inspiration;
  compact?: boolean;
}) {
  const retryAction = retryInspiration.bind(null, row.id);
  const deleteAction = deleteInspiration.bind(null, row.id);

  return (
    <div className={`flex gap-3 ${compact ? 'text-xs' : 'text-xs pt-1'}`}>
      {row.scrape_status === 'failed' && (
        <form action={retryAction}>
          <button
            type="submit"
            className="text-blue-500 hover:underline"
          >
            リトライ
          </button>
        </form>
      )}
      <a
        href={row.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-zinc-500 hover:underline"
      >
        Threadsで見る
      </a>
      <form action={deleteAction}>
        <button type="submit" className="text-red-500 hover:underline">
          削除
        </button>
      </form>
    </div>
  );
}
