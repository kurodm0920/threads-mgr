import Link from 'next/link';
import { getServiceClient } from '@/lib/supabase/server';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ oauth_success?: string; oauth_error?: string }>;
}) {
  const params = await searchParams;

  const supabase = getServiceClient();
  const { data: account } = await supabase
    .from('accounts')
    .select('threads_username, threads_user_id, token_expires_at, is_active, refreshed_at')
    .eq('is_active', true)
    .maybeSingle();

  const expiresAt = account?.token_expires_at
    ? new Date(account.token_expires_at)
    : null;
  const daysUntilExpiry = expiresAt
    ? Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">設定</h1>

      {params.oauth_success && (
        <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded text-green-800 dark:text-green-300">
          ✅ Threadsアカウント連携が完了しました
        </div>
      )}
      {params.oauth_error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded text-red-800 dark:text-red-300 break-all">
          ❌ エラー: {params.oauth_error}
        </div>
      )}

      <section className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Threadsアカウント連携</h2>

        {account ? (
          <div className="space-y-3 text-sm">
            <p>
              連携中:{' '}
              <strong className="font-mono">@{account.threads_username}</strong>
            </p>
            <p className="text-zinc-500">
              ユーザーID: {account.threads_user_id}
            </p>
            {expiresAt && (
              <p>
                トークン有効期限:{' '}
                <span
                  className={
                    daysUntilExpiry !== null && daysUntilExpiry < 14
                      ? 'text-orange-600 font-semibold'
                      : ''
                  }
                >
                  {expiresAt.toLocaleString('ja-JP')}（残り{daysUntilExpiry}日）
                </span>
              </p>
            )}
            <Link
              href="/oauth/threads/start"
              className="inline-block mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              再認証
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500">
              Threadsアカウントを連携してください。連携すると投稿・数値取得が可能になります。
            </p>
            <Link
              href="/oauth/threads/start"
              className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              Threadsで連携する
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
