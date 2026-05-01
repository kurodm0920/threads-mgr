const CONFIG: Record<string, { label: string; color: string }> = {
  queued: {
    label: '予約済み',
    color:
      'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  },
  publishing: {
    label: '送信中',
    color:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  },
  published: {
    label: '投稿済み',
    color:
      'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  },
  failed: {
    label: '失敗',
    color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  },
  canceled: {
    label: 'キャンセル',
    color:
      'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  },
};

export function StatusBadge({ status }: { status: string }) {
  const c = CONFIG[status] ?? {
    label: status,
    color: 'bg-zinc-100 text-zinc-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${c.color}`}>{c.label}</span>
  );
}
