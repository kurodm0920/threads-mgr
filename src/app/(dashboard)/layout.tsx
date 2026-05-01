import { redirect } from 'next/navigation';
import Link from 'next/link';
import { isAuthenticated } from '@/lib/auth/session';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-3">
        <div className="flex items-center justify-between gap-6">
          <Link href="/calendar" className="font-bold whitespace-nowrap">
            占いThreads管理
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/calendar" className="hover:underline">
              カレンダー
            </Link>
            <Link href="/analytics" className="hover:underline">
              分析
            </Link>
            <Link href="/drafts" className="hover:underline">
              下書き
            </Link>
            <Link href="/inspirations" className="hover:underline">
              参考投稿
            </Link>
            <Link href="/line-input" className="hover:underline">
              LINE入力
            </Link>
            <Link href="/settings" className="hover:underline">
              設定
            </Link>
            <form action="/api/logout" method="POST">
              <button
                type="submit"
                className="text-red-500 hover:underline"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </nav>
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  );
}
