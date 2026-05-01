import { getServiceClient } from '@/lib/supabase/server';
import { saveLineConversion } from './actions';

export const dynamic = 'force-dynamic';

export default async function LineInputPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const supabase = getServiceClient();

  const { data: account } = await supabase
    .from('accounts')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();

  if (!account) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">LINE誘導記録</h1>
        <div className="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded text-sm">
          先に Threads アカウントを連携してください（設定ページから）
        </div>
      </div>
    );
  }

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  const { data: conversions } = await supabase
    .from('line_conversions')
    .select('*')
    .eq('account_id', account.id)
    .gte('date', fromDateStr)
    .order('date', { ascending: false });

  const today = new Date().toISOString().split('T')[0];

  const totals = (conversions ?? []).reduce(
    (acc, c) => ({
      friends: acc.friends + (c.friends_added ?? 0),
      consultations: acc.consultations + (c.consultations ?? 0),
    }),
    { friends: 0, consultations: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">LINE誘導記録</h1>
        <div className="text-sm text-zinc-500">
          過去30日合計: 友だち追加 <strong>{totals.friends}</strong> /
          鑑定依頼 <strong>{totals.consultations}</strong>
        </div>
      </div>

      {params.saved && (
        <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded text-sm text-green-800 dark:text-green-300">
          ✅ 保存しました
        </div>
      )}

      <form
        action={saveLineConversion}
        className="bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 p-6 space-y-4"
      >
        <h2 className="text-sm font-semibold text-zinc-500">日次入力</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="space-y-1">
            <span className="block text-xs text-zinc-500">日付</span>
            <input
              type="date"
              name="date"
              defaultValue={today}
              required
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-zinc-500">友だち追加数</span>
            <input
              type="number"
              name="friends_added"
              min="0"
              defaultValue="0"
              required
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-zinc-500">鑑定依頼数</span>
            <input
              type="number"
              name="consultations"
              min="0"
              defaultValue="0"
              required
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-sm"
            />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="block text-xs text-zinc-500">メモ（任意）</span>
          <textarea
            name="notes"
            rows={2}
            placeholder="例: 朝7:30の星模様投稿バズった日"
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-sm"
          />
        </label>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
        >
          保存（同日付なら上書き）
        </button>
      </form>

      <section className="bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-500">過去30日の記録</h2>
        {conversions && conversions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="text-left py-2 px-2">日付</th>
                  <th className="text-right py-2 px-2">友だち追加</th>
                  <th className="text-right py-2 px-2">鑑定依頼</th>
                  <th className="text-left py-2 px-2">メモ</th>
                </tr>
              </thead>
              <tbody>
                {conversions.map((c) => (
                  <tr
                    key={c.date}
                    className="border-b border-zinc-100 dark:border-zinc-900 last:border-0"
                  >
                    <td className="py-2 px-2 font-mono">{c.date}</td>
                    <td className="text-right py-2 px-2 font-mono">
                      {c.friends_added}
                    </td>
                    <td className="text-right py-2 px-2 font-mono">
                      {c.consultations}
                    </td>
                    <td className="py-2 px-2 text-zinc-500 text-xs">
                      {c.notes ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">まだ記録がありません</p>
        )}
      </section>
    </div>
  );
}
