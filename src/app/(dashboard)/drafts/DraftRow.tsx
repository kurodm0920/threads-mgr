'use client';

import { useState, useTransition } from 'react';
import { updateDraft, cancelDraft, shiftDraft } from './actions';

interface Draft {
  id: string;
  scheduled_at: string;
  body: string;
  genre: string | null;
  content_type: string | null;
  has_cta: boolean;
}

function toLocalInputValue(iso: string): string {
  // datetime-local 用に YYYY-MM-DDTHH:MM 形式（JST）
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 16);
}

function fromLocalInputValue(local: string): string {
  // datetime-local の値（JST想定）を ISO UTC に
  const d = new Date(local);
  const jstOffsetMs = 9 * 60 * 60 * 1000;
  return new Date(d.getTime() - jstOffsetMs).toISOString();
}

export function DraftRow({ row }: { row: Draft }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(row.body);
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue(row.scheduled_at));
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('id', row.id);
      fd.set('body', body);
      fd.set('scheduled_at', fromLocalInputValue(scheduledAt));
      try {
        await updateDraft(fd);
        setEditing(false);
      } catch (e) {
        alert('保存失敗: ' + (e as Error).message);
      }
    });
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            予約済み
          </span>
          {row.genre && (
            <span className="text-zinc-500">
              [{row.genre}/{row.content_type ?? '-'}]
            </span>
          )}
          {row.has_cta && (
            <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700">
              CTA
            </span>
          )}
        </div>
        <time className="text-zinc-500 font-mono">
          {new Date(row.scheduled_at).toLocaleString('ja-JP', {
            timeZone: 'Asia/Tokyo',
          })}
        </time>
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-sm whitespace-pre-wrap"
          />
          <div className="flex gap-2 text-xs">
            <button
              onClick={handleSave}
              disabled={pending}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
            >
              {pending ? '保存中...' : '保存'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setBody(row.body);
                setScheduledAt(toLocalInputValue(row.scheduled_at));
              }}
              className="px-3 py-1 bg-zinc-200 dark:bg-zinc-800 rounded"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {row.body}
          </p>
          <div className="flex gap-3 text-xs pt-1">
            <button
              onClick={() => setEditing(true)}
              className="text-blue-500 hover:underline"
            >
              編集
            </button>
            <ShiftButtons id={row.id} />
            <CancelButton id={row.id} />
          </div>
        </>
      )}
    </div>
  );
}

function ShiftButtons({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  function shift(h: number) {
    startTransition(async () => {
      await shiftDraft(id, h);
    });
  }
  return (
    <>
      <button
        onClick={() => shift(-1)}
        disabled={pending}
        className="text-zinc-500 hover:underline disabled:opacity-50"
        title="1時間前にシフト"
      >
        -1h
      </button>
      <button
        onClick={() => shift(1)}
        disabled={pending}
        className="text-zinc-500 hover:underline disabled:opacity-50"
        title="1時間後にシフト"
      >
        +1h
      </button>
      <button
        onClick={() => shift(24)}
        disabled={pending}
        className="text-zinc-500 hover:underline disabled:opacity-50"
        title="翌日同時刻にシフト"
      >
        +1日
      </button>
    </>
  );
}

function CancelButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  function handle() {
    if (!confirm('この予約をキャンセルしますか？（投稿されなくなります）')) return;
    startTransition(async () => {
      await cancelDraft(id);
    });
  }
  return (
    <button
      onClick={handle}
      disabled={pending}
      className="text-red-500 hover:underline disabled:opacity-50"
    >
      キャンセル
    </button>
  );
}
