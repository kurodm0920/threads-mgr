'use client';

import { useState, useTransition } from 'react';
import {
  registerSingleInspiration,
  registerTreeInspiration,
} from './actions';

export function RegisterForm() {
  const [mode, setMode] = useState<'single' | 'tree'>('single');
  const [treeUrls, setTreeUrls] = useState<string[]>(['', '']);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        if (mode === 'single') {
          await registerSingleInspiration(formData);
        } else {
          await registerTreeInspiration(formData);
        }
        // success → revalidatePath が走る
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <section className="bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 p-6 space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('single')}
          className={`px-3 py-1 rounded text-sm ${
            mode === 'single'
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
          }`}
        >
          単発登録
        </button>
        <button
          type="button"
          onClick={() => setMode('tree')}
          className={`px-3 py-1 rounded text-sm ${
            mode === 'tree'
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
          }`}
        >
          ツリー登録（連投複数）
        </button>
      </div>

      <form action={handleSubmit} className="space-y-3">
        {mode === 'single' ? (
          <label className="block space-y-1">
            <span className="block text-xs text-zinc-500">投稿URL</span>
            <input
              type="url"
              name="url"
              required
              placeholder="https://www.threads.com/@xxx/post/abc123"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-sm font-mono"
            />
          </label>
        ) : (
          <div className="space-y-2">
            <span className="block text-xs text-zinc-500">
              連投URL（順序通り、最低2件）
            </span>
            {treeUrls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-xs text-zinc-500 self-center w-12">
                  #{i + 1}
                  {i === 0 ? '(親)' : ''}
                </span>
                <input
                  type="url"
                  name="urls"
                  required
                  value={url}
                  onChange={(e) => {
                    const next = [...treeUrls];
                    next[i] = e.target.value;
                    setTreeUrls(next);
                  }}
                  placeholder="https://www.threads.com/@xxx/post/..."
                  className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-sm font-mono"
                />
                {treeUrls.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setTreeUrls(treeUrls.filter((_, j) => j !== i))}
                    className="text-xs text-red-500 px-2"
                  >
                    削除
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setTreeUrls([...treeUrls, ''])}
              className="text-xs text-blue-500 hover:underline"
            >
              + URL追加
            </button>
          </div>
        )}

        <label className="block space-y-1">
          <span className="block text-xs text-zinc-500">メモ（任意）</span>
          <textarea
            name="my_notes"
            rows={2}
            placeholder="例: 冒頭の問いかけが秀逸"
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-sm"
          />
        </label>

        {error && (
          <p className="text-sm text-red-500 break-all">⚠ {error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50"
        >
          {pending
            ? '登録中...'
            : mode === 'single'
              ? '登録（取得は5分以内に自動完了）'
              : 'ツリー登録'}
        </button>
      </form>
    </section>
  );
}
