// 投稿に添付できる画像プール
// public/buzz-images/ に置いてあるファイルを Vercel が静的配信する

export type BuzzImageTheme = 'moon' | 'shrine' | 'cherry';

export interface BuzzImage {
  filename: string;
  theme: BuzzImageTheme;
}

export const BUZZ_IMAGES: BuzzImage[] = [
  { filename: 'moon-01.jpg', theme: 'moon' },
  { filename: 'moon-02.jpg', theme: 'moon' },
  { filename: 'moon-03.jpg', theme: 'moon' },
  { filename: 'moon-04.jpg', theme: 'moon' },
  { filename: 'moon-05.jpg', theme: 'moon' },
  { filename: 'shrine-01.jpg', theme: 'shrine' },
  { filename: 'shrine-02.jpg', theme: 'shrine' },
  { filename: 'shrine-03.jpg', theme: 'shrine' },
  { filename: 'cherry-01.jpg', theme: 'cherry' },
  { filename: 'cherry-02.jpg', theme: 'cherry' },
];

function getBaseUrl(): string {
  // Vercel 環境では VERCEL_URL（プロトコルなし）が入る。
  // 本番固定の公開ドメインを優先。
  const env = process.env.VERCEL_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';
  if (env.startsWith('http')) return env.replace(/\/$/, '');
  if (env) return `https://${env}`;
  return 'https://threads-mgr.vercel.app';
}

export function imageUrl(filename: string): string {
  return `${getBaseUrl()}/buzz-images/${filename}`;
}

export function pickRandomImage(theme?: BuzzImageTheme): BuzzImage {
  const pool = theme
    ? BUZZ_IMAGES.filter((i) => i.theme === theme)
    : BUZZ_IMAGES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickRandomImageUrl(theme?: BuzzImageTheme): string {
  return imageUrl(pickRandomImage(theme).filename);
}
