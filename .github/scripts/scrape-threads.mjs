import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  createStealthContext,
  gateInterval,
  gotoWithBackoff,
  humanScroll,
  jitter,
} from './lib/stealth.mjs';

const SCREENSHOT_DIR = 'screenshots';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const VERCEL_URL = process.env.VERCEL_URL;
const CRON_SECRET = process.env.CRON_SECRET;

if (!VERCEL_URL || !CRON_SECRET) {
  console.error('Missing env: VERCEL_URL or CRON_SECRET');
  process.exit(1);
}

const NAV_TIMEOUT = 30000;

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
  await gateInterval(4000);
  await gotoWithBackoff(page, url, 3, NAV_TIMEOUT);
  await jitter(1800, 3200);
  await humanScroll(page, 400, 5);
  await jitter(500, 1200);

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

    // URL から post_id 抽出（連投投稿で正しい article を選ぶため）
    const urlPostMatch = window.location.pathname.match(/\/post\/([^/?]+)/);
    const targetPostId = urlPostMatch ? urlPostMatch[1] : null;

    // 対象 post_id を含む article を優先的に選ぶ
    const allArticles = document.querySelectorAll(
      'main article, [data-pressable-container]'
    );
    let article = null;
    if (targetPostId) {
      for (const a of allArticles) {
        const link = a.querySelector(`a[href*="/post/${targetPostId}"]`);
        if (link) {
          article = a;
          break;
        }
      }
    }
    // フォールバック: 最初の article
    if (!article) article = allArticles[0] ?? null;

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

    // 戦略2: article 内の数字付き短い span を DOM順に取得（engagement bar）
    // Threads UI は左から ❤️ → 💬 → 🔄 → ↗️ の順
    // ※ 上で宣言した article を再利用
    const numericSeq = [];
    const debugSpans = [];
    if (article) {
      article.querySelectorAll('span').forEach((s) => {
        const t = (s.textContent ?? '').trim();
        if (t.length > 0 && t.length < 10 && /^[\d,]+(\.\d+)?[万千KMk]?$/.test(t)) {
          numericSeq.push(t);
        }
        if (t.length > 0 && t.length < 30 && /\d/.test(t)) {
          debugSpans.push(t);
        }
      });
    }
    // 重複除去（連続した同値はスキップ）
    const dedup = [];
    for (const t of numericSeq) {
      if (dedup[dedup.length - 1] !== t) dedup.push(t);
    }

    if (likes_count === null && dedup[0]) likes_count = parseCount(dedup[0]);
    if (replies_count === null && dedup[1]) replies_count = parseCount(dedup[1]);
    if (reposts_count === null && dedup[2]) reposts_count = parseCount(dedup[2]);

    // views (閲覧数): span のテキストで "表示N回" or "N views" パターン
    let views_count = null;
    const allSpans = document.querySelectorAll('span');
    for (const s of allSpans) {
      const t = (s.textContent ?? '').trim();
      if (!t || t.length > 40) continue;
      const m = t.match(/^(?:表示|閲覧数?)\s*([\d,.]+[万千KMk]?)\s*(?:回|views?)?$/i)
        ?? t.match(/^([\d,.]+[万千KMk]?)\s*(?:views?)$/i);
      if (m) {
        views_count = parseCount(m[1]);
        break;
      }
    }

    // 投稿時刻
    const timeEl = article?.querySelector('time') ?? document.querySelector('time');
    const published_at = timeEl?.getAttribute('datetime') ?? null;

    // === ツリー検出: 同一ユーザーの隣接記事を子として収集 ===
    const tree_children = [];
    if (account_handle && targetPostId) {
      for (const a of allArticles) {
        if (a === article) continue;
        // この article の主投稿者を判定: /@<handle>/ リンクが含まれる
        const profileLinks = a.querySelectorAll('a[href^="/@"]');
        let authorMatch = false;
        for (const link of profileLinks) {
          const m = link.getAttribute('href')?.match(/^\/@([^/]+)/);
          if (m && m[1] === account_handle) {
            authorMatch = true;
            break;
          }
        }
        if (!authorMatch) continue;

        // post_id 抽出
        const postLinks = a.querySelectorAll('a[href*="/post/"]');
        let childPostId = null;
        for (const pl of postLinks) {
          const m = pl.getAttribute('href')?.match(/\/post\/([^/?#]+)/);
          if (m && m[1] !== targetPostId) {
            childPostId = m[1];
            break;
          }
        }
        if (!childPostId) continue;

        // 子の本文抽出
        let childBody = '';
        a.querySelectorAll('div[dir], span[dir]').forEach((el) => {
          const t = el.innerText?.trim() ?? '';
          if (t.length > childBody.length && t.length > 5) childBody = t;
        });
        if (!childBody) continue;

        // 子の投稿時刻
        const childTimeEl = a.querySelector('time');
        const childPublishedAt = childTimeEl?.getAttribute('datetime') ?? null;

        tree_children.push({
          threads_post_id: childPostId,
          source_url: `https://www.threads.com/@${account_handle}/post/${childPostId}`,
          body: childBody.slice(0, 4000),
          published_at: childPublishedAt,
        });
      }
    }

    // 重複排除（同じ post_id を2回拾ったら1回に）
    const dedupChildren = [];
    const seenIds = new Set();
    for (const c of tree_children) {
      if (seenIds.has(c.threads_post_id)) continue;
      seenIds.add(c.threads_post_id);
      dedupChildren.push(c);
    }

    return {
      body,
      account_handle,
      likes_count,
      replies_count,
      reposts_count,
      views_count,
      published_at,
      tree_children: dedupChildren,
      _debug_labels: debugLabels.slice(0, 15),
      _debug_spans: debugSpans.slice(0, 20),
    };
  });

  if (!data.body || data.body.length < 5) {
    throw new Error('本文抽出失敗（HTML構造変化の可能性）');
  }

  return data;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await createStealthContext(browser);

  let totalSucceeded = 0;
  let totalFailed = 0;
  let batchNum = 0;
  const MAX_BATCHES = 20; // 暴走防止: 50件 × 20 = 最大1000件、workflow タイムアウト30分以内に収める

  while (batchNum < MAX_BATCHES) {
    const items = await getPending();
    if (items.length === 0) {
      console.log(`\nNo more pending items. Stopping after ${batchNum} batch(es).`);
      break;
    }
    batchNum++;
    console.log(`\n=== Batch ${batchNum}: ${items.length} items ===`);

    for (const item of items) {
      const page = await context.newPage();
      try {
        console.log(`→ ${item.source_url}`);
        const data = await scrape(page, item.source_url);
        console.log(`  ✅ body: ${(data.body ?? '').slice(0, 60)}...`);
        console.log(
          `     metrics: views=${data.views_count} likes=${data.likes_count} replies=${data.replies_count} reposts=${data.reposts_count} tree_children=${data.tree_children?.length ?? 0}`
        );
        if (data._debug_spans?.length) {
          console.log(`     debug spans: ${data._debug_spans.slice(0, 12).join(' | ')}`);
        }
        // debug フィールドは DB に送らない
        const { _debug_labels: _l, _debug_spans: _s, ...payload } = data;
        void _l;
        void _s;
        await patchResult(item.id, { success: true, ...payload });
        totalSucceeded++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ❌ ${msg}`);
        await page
          .screenshot({
            path: join(SCREENSHOT_DIR, `scrape-FAILED-${item.id}.png`),
            fullPage: false,
          })
          .catch(() => {});
        await patchResult(item.id, { success: false, error: msg });
        totalFailed++;
      } finally {
        await page.close();
      }
    }
  }

  await browser.close();
  console.log(`\nDone: ${totalSucceeded} succeeded, ${totalFailed} failed across ${batchNum} batch(es)`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
