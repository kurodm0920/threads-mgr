// Bot 検知対策の共通レイヤ
// Qiita 記事「Playwright のBot検知対策18層」より、効果と低コストのバランスで6層を採用
//
// 採用層:
//   1) User-Agent + sec-ch-ua 整合（矛盾してると一発でバレる）
//   2-3) navigator フラグ偽装（webdriver / languages / plugins / __playwright 削除）
//   5) ランダム待機ジッタ
//   6) 段階的スクロール（遅延ロード対策にもなる）
//   7) リクエスト間隔の下限保証
//   9) 403/429 検出時の指数バックオフ

const REAL_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export async function createStealthContext(browser) {
  const context = await browser.newContext({
    userAgent: REAL_UA,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: {
      'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'accept-language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['ja-JP', 'ja', 'en-US', 'en'],
    });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'PDF Viewer' },
        { name: 'Chrome PDF Viewer' },
        { name: 'Chromium PDF Viewer' },
        { name: 'Microsoft Edge PDF Viewer' },
        { name: 'WebKit built-in PDF' },
      ],
    });
    delete window.__playwright;
    delete window.__pw_manual;
    delete window.__PW_inspect;
  });

  return context;
}

export const jitter = (minMs, maxMs) =>
  new Promise((r) => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));

export async function humanScroll(page, distance = 800, steps = 8) {
  const step = Math.round(distance / steps);
  for (let i = 0; i < steps; i++) {
    await page.evaluate((s) => window.scrollBy(0, s), step);
    await jitter(120, 280);
  }
}

let lastRequestAt = 0;
export async function gateInterval(minMs = 4000) {
  const now = Date.now();
  const diff = now - lastRequestAt;
  if (diff < minMs) {
    const wait = minMs - diff;
    await jitter(wait, wait + 1500);
  }
  lastRequestAt = Date.now();
}

export async function gotoWithBackoff(page, url, maxRetries = 3, timeout = 30000) {
  for (let i = 0; i < maxRetries; i++) {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    const status = resp?.status() ?? 0;
    if (status > 0 && status < 400) return resp;
    if (status === 403 || status === 429) {
      const waitMs = 60_000 * Math.pow(2, i) + Math.random() * 30_000;
      console.warn(
        `[stealth] status ${status} on ${url}, backoff ${Math.round(waitMs / 1000)}s`,
      );
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    throw new Error(`Unexpected status ${status} for ${url}`);
  }
  throw new Error(`Max retries exceeded for ${url}`);
}
