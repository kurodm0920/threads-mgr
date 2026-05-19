---
description: 占い系キーワードでトレンド＆バズ投稿を Playwright で自動収集（任意タイミング）
---

# /discover-trends

GitHub Actions workflow `Discover Trends` を起動し、占い系キーワード10個の検索結果から TOP10 投稿の URL を取得 → `inspirations` テーブルに `source='keyword_trend'` で登録。10〜15分後にダッシュボードの「トレンド」タブに本文・いいね数つきで反映される。

## 実行手順

### 1. 起動

`.env.local` から `GITHUB_PAT`（GitHub Personal Access Token、scope: `actions:write` or `workflow` 権限のあるトークン）を読み込んで、workflow_dispatch を叩く。

```bash
node --env-file=.env.local -e "
const pat = process.env.GITHUB_PAT;
if (!pat) { console.error('GITHUB_PAT が未設定。.env.local を確認してください'); process.exit(1); }
fetch('https://api.github.com/repos/kurodm0920/threads-mgr/actions/workflows/discover-trends.yml/dispatches', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer ' + pat,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
  body: JSON.stringify({ ref: 'main' }),
}).then(async r => {
  if (r.status === 204) console.log('✅ workflow_dispatch 起動成功');
  else console.error('❌ 失敗:', r.status, await r.text());
});
"
```

### 2. 案内

起動成功なら、ユーザーに次のように案内:

```
✅ Discover Trends workflow を起動しました。

10〜15分後に以下で結果確認できます:
- GitHub Actions: https://github.com/kurodm0920/threads-mgr/actions/workflows/discover-trends.yml
- ダッシュボード: https://<vercel-domain>/inspirations → トレンドタブ

ワークフロー内訳:
  Step 1: Playwright で10キーワード × TOP10 URL 収集（約1-2分）
  Step 2: 既存の Scrape Inspirations が pending を順次処理して本文・メトリクス取得（5-10分）
```

## キーワードリスト（変更したい場合）

`.github/scripts/discover-trends.mjs` の `KEYWORDS` 定数を編集:

- 西洋占星術 / 四柱推命 / 紫微斗数 / タロット（ジャンル）
- 恋愛運 / 恋愛 占い / 今日の運勢（テーマ）
- 水星逆行 / 新月 / 満月（時節）

## 注意

- 起動頻度は任意。週1〜月数回の低頻度運用想定（Threads ToS グレー対策）
- 検知された場合は素直に頻度を下げる
- 失敗時は GitHub Actions ログを確認
