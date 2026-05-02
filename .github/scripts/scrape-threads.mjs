import { chromium } from 'playwright';

const VERCEL_URL = process.env.VERCEL_URL;
const CRON_SECRET = process.env.CRON_SECRET;

if (!VERCEL_URL || !CRON_SECRET) {
  console.error('Missing env: VERCEL_URL or CRON_SECRET');
  process.exit(1);
}

const NAV_TIMEOUT = 30000;
const SETTLE_MS = 2500;

async function getPending() {
  const res = await fetch(`${VERCEL_URL}/api/inspirations/pending`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  if (!res.ok) {
    throw new Error(`pending fetch failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.items ?? [];
}

async function patchResult(id, payload) {
  const res = await fetch(`${VERCEL_URL}/api/inspirations/${id}/scraped`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error(`PATCH failed for ${id}: HTTP ${res.status}`, await res.text());
  }
}

async function scrape(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
  await page.waitForTimeout(SETTLE_MS);

  const data = await page.evaluate(() => {
    function parseCount(text) {
      if (!text) return null;
      const m = text.match(/([\d,.]+)\s*([万千KMk]?)/);
      if (!m) return null;
      const num = parseFloat(m[1].replace(/,/g, ''));
      const unit = m[2];
      if (unit === '万') return Math.round(num * 10000);
      if (unit === '千') return Math.round(num * 1000);
      if (unit === 'K' || unit === 'k') return Math.round(num * 1000);
      if (unit === 'M') return Math.round(num * 1000000);
      return Math.round(num);
    }

    // 本文候補（複数の構造を試す）
    const article = document.querySelector('main article, [data-pressable-container]');
    let body = null;
    if (article) {
      // 本文はだいたい最初の長いテキストブロック
      const candidates = article.querySelectorAll('div[dir], span[dir]');
      let longest = '';
      for (const el of candidates) {
        const t = el.innerText?.trim() ?? '';
        if (t.length > longest.length && t.length > 10) {
          longest = t;
        }
      }
      body = longest || article.innerText?.trim()?.slice(0, 2000) || null;
    }

    // username (URL は /@username/post/...)
    const pathMatch = window.location.pathname.match(/^\/@([^/]+)\//);
    const account_handle = pathMatch ? pathMatch[1] : null;

    // metrics: aria-label や buttons から
    let likes_count = null, replies_count = null, reposts_count = null;
    const buttons = document.querySelectorAll('[role="button"], [role="link"]');
    for (const btn of buttons) {
      const label = (btn.getAttribute('aria-label') ?? '').toLowerCase();
      const text = btn.innerText ?? '';
      if (/like|いいね/i.test(label) && likes_count === null) {
        likes_count = parseCount(text) ?? parseCount(label);
      } else if (/repl|reply|返信|コメント/i.test(label) && replies_count === null) {
        replies_count = parseCount(text) ?? parseCount(label);
      } else if (/repost|再投稿|リポスト/i.test(label) && reposts_count === null) {
        reposts_count = parseCount(text) ?? parseCount(label);
      }
    }

    // 投稿時刻
    const timeEl = document.querySelector('time');
    const published_at = timeEl?.getAttribute('datetime') ?? null;

    return { body, account_handle, likes_count, replies_count, reposts_count, published_at };
  });

  if (!data.body || data.body.length < 5) {
    throw new Error('本文抽出失敗（HTML構造変化の可能性）');
  }

  return data;
}

async function main() {
  const items = await getPending();
  console.log(`Pending: ${items.length} items`);
  if (items.length === 0) {
    console.log('Nothing to scrape');
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1280, height: 800 },
  });

  let succeeded = 0;
  let failed = 0;

  for (const item of items) {
    const page = await context.newPage();
    try {
      console.log(`→ ${item.source_url}`);
      const data = await scrape(page, item.source_url);
      await patchResult(item.id, { success: true, ...data });
      console.log(`  ✅ ${(data.body ?? '').slice(0, 60)}...`);
      succeeded++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  ❌ ${msg}`);
      await patchResult(item.id, { success: false, error: msg });
      failed++;
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`\nDone: ${succeeded} succeeded, ${failed} failed`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
