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

    // === metrics 抽出 ===
    let likes_count = null, replies_count = null, reposts_count = null;

    // 戦略1: aria-label に "N件のいいね" "N likes" 等のパターン
    const allLabeled = document.querySelectorAll('[aria-label]');
    const debugLabels = [];
    for (const el of allLabeled) {
      const lbl = el.getAttribute('aria-label') ?? '';
      if (lbl.length > 200) continue;
      if (!/\d/.test(lbl)) continue;
      debugLabels.push(lbl);

      const numMatch = lbl.match(/[\d,]+/);
      if (!numMatch) continue;
      const num = parseInt(numMatch[0].replace(/,/g, ''), 10);
      if (isNaN(num)) continue;

      if (likes_count === null && /(いいね|like)/i.test(lbl)) likes_count = num;
      else if (replies_count === null && /(返信|reply|repl|コメント|comment)/i.test(lbl)) replies_count = num;
      else if (reposts_count === null && /(再投稿|repost|share|シェア)/i.test(lbl)) reposts_count = num;
    }

    // 戦略2: SVG アイコンの近くの数字（ハート/吹き出し/リポストアイコン）
    if (likes_count === null || replies_count === null || reposts_count === null) {
      const buttons = document.querySelectorAll('[role="button"], [role="link"], button, a');
      for (const btn of buttons) {
        const text = (btn.textContent ?? '').trim();
        if (!text || text.length > 20) continue;
        const numMatch = text.match(/^[\d,.]+[万千KMk]?$/);
        if (!numMatch) continue;
        const num = parseCount(text);
        if (num === null) continue;

        const ariaLabel = btn.getAttribute('aria-label') ?? '';
        const html = btn.innerHTML ?? '';
        // SVG の近くで判定
        if (likes_count === null && /(いいね|like|heart)/i.test(ariaLabel + html)) {
          likes_count = num;
        } else if (replies_count === null && /(返信|reply|comment)/i.test(ariaLabel + html)) {
          replies_count = num;
        } else if (reposts_count === null && /(再投稿|repost)/i.test(ariaLabel + html)) {
          reposts_count = num;
        }
      }
    }

    // 投稿時刻
    const timeEl = document.querySelector('time');
    const published_at = timeEl?.getAttribute('datetime') ?? null;

    return {
      body,
      account_handle,
      likes_count,
      replies_count,
      reposts_count,
      published_at,
      _debug_labels: debugLabels.slice(0, 15),
    };
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
      console.log(`  ✅ body: ${(data.body ?? '').slice(0, 60)}...`);
      console.log(
        `     metrics: likes=${data.likes_count} replies=${data.replies_count} reposts=${data.reposts_count}`
      );
      if (data._debug_labels?.length) {
        console.log(`     debug aria-labels: ${data._debug_labels.slice(0, 8).join(' | ')}`);
      }
      // _debug_labels は DB に送らない
      const { _debug_labels: _, ...payload } = data;
      void _;
      await patchResult(item.id, { success: true, ...payload });
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
