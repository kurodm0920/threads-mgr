// 占い系キーワードの検索ページを Playwright で巡回し、上位投稿の URL を発見
// → /api/inspirations/discovered に POST して inspirations に登録（scrape_status='pending'）
// → 既存の scrape-threads.mjs が pending を順に拾って本文・メトリクスを取得

import { chromium } from 'playwright';
import {
  createStealthContext,
  gateInterval,
  gotoWithBackoff,
  humanScroll,
  jitter,
} from './lib/stealth.mjs';

const VERCEL_URL = process.env.VERCEL_URL;
const CRON_SECRET = process.env.CRON_SECRET;

if (!VERCEL_URL || !CRON_SECRET) {
  console.error('Missing env: VERCEL_URL or CRON_SECRET');
  process.exit(1);
}

const KEYWORDS = [
  { keyword: '西洋占星術', category: 'genre' },
  { keyword: '四柱推命', category: 'genre' },
  { keyword: '紫微斗数', category: 'genre' },
  { keyword: 'タロット', category: 'genre' },
  { keyword: '恋愛運', category: 'theme' },
  { keyword: '恋愛 占い', category: 'theme' },
  { keyword: '今日の運勢', category: 'theme' },
  { keyword: '水星逆行', category: 'season' },
  { keyword: '新月', category: 'season' },
  { keyword: '満月', category: 'season' },
];

const TOP_N = 10;
const OWN_HANDLES = ['shima_lovefortune'];

function buildSearchUrl(keyword) {
  return `https://www.threads.com/search?q=${encodeURIComponent(keyword)}&serp_type=default`;
}

async function extractPostUrls(page, keyword) {
  await humanScroll(page, 1600, 12);
  await jitter(800, 1500);

  const items = await page.evaluate((maxN) => {
    const seen = new Set();
    const results = [];
    const anchors = document.querySelectorAll('a[href*="/post/"]');
    let rank = 0;
    for (const a of anchors) {
      const href = a.getAttribute('href');
      if (!href) continue;
      const m = href.match(/^\/@([^/]+)\/post\/([^/?#]+)/);
      if (!m) continue;
      const handle = m[1];
      const postId = m[2];
      const dedupKey = `${handle}/${postId}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      rank += 1;
      results.push({
        url: `https://www.threads.com/@${handle}/post/${postId}`,
        account_handle: handle,
        threads_post_id: postId,
        rank,
      });
      if (results.length >= maxN) break;
    }
    return results;
  }, TOP_N);

  return items
    .filter((it) => !OWN_HANDLES.includes(it.account_handle))
    .map((it) => ({ ...it, keyword_matched: keyword }));
}

async function postDiscovered(rows) {
  const res = await fetch(`${VERCEL_URL}/api/inspirations/discovered`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`discovered POST failed: HTTP ${res.status} ${txt}`);
  }
  return await res.json();
}

async function main() {
  console.log(`Discovering trends for ${KEYWORDS.length} keywords (TOP ${TOP_N} each)`);

  const browser = await chromium.launch({ headless: true });
  const context = await createStealthContext(browser);
  const page = await context.newPage();

  const allRows = [];
  let succeeded = 0;
  let failed = 0;

  for (const { keyword } of KEYWORDS) {
    try {
      const url = buildSearchUrl(keyword);
      console.log(`→ [${keyword}] ${url}`);
      await gateInterval(5000);
      await gotoWithBackoff(page, url, 3, 30000);
      await jitter(2500, 4500);

      const rows = await extractPostUrls(page, keyword);
      console.log(`  found ${rows.length} URLs`);
      allRows.push(...rows);
      succeeded++;
      await jitter(5000, 10000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ❌ [${keyword}] ${msg}`);
      failed++;
    }
  }

  await browser.close();

  console.log(`\nKeywords: ${succeeded} succeeded, ${failed} failed`);
  console.log(`Total discovered URLs: ${allRows.length}`);

  if (allRows.length === 0) {
    console.log('Nothing to post');
    return;
  }

  const result = await postDiscovered(allRows);
  console.log(`Inserted: ${result.inserted ?? 0}, skipped (existing): ${result.skipped ?? 0}`);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
