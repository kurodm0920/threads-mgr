import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth/session';
import { loginAction } from './actions';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (await isAuthenticated()) {
    redirect('/calendar');
  }

  const params = await searchParams;
  const error = params.error;
  const next = params.next ?? '/calendar';

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <form
        action={loginAction}
        className="w-full max-w-sm space-y-4 p-8 bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-800"
      >
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">占いThreads管理</h1>
          <p className="text-sm text-zinc-500">ログイン</p>
        </div>
        <input type="hidden" name="next" value={next} />
        <input
          type="password"
          name="password"
          placeholder="パスワード"
          required
          autoFocus
          className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error === 'invalid' && (
          <p className="text-sm text-red-500 text-center">パスワードが違います</p>
        )}
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
        >
          ログイン
        </button>
      </form>
    </div>
  );
}
