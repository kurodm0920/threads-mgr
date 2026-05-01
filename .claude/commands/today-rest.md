---
description: 今日の昼/夕/夜/深夜4投稿を生成して予約に投入
---

# /today-rest

今日の昼12:15・夕18:00・夜21:30・深夜23:45 の4投稿を生成し、scheduled_posts に予約INSERT する。

## 実行手順

### 1. 環境変数読み込み
```bash
source <(grep -v '^#' .env.local | sed 's/^/export /')
```
or `node --env-file=.env.local -e "console.log(process.env.CC_API_KEY)"` で取得。

### 2. 過去7日のデータ取得
```bash
curl -k -s -H "Authorization: Bearer $CC_API_KEY" \
  "https://localhost:3001/api/cc/inspirations-export?days=7" \
  > /tmp/cc-export.json
```

このJSONには:
- `published_posts`: 過去投稿（本文・ジャンル・タイプ）
- `post_metrics`: 各投稿の数値（views/likes/replies/reposts/quotes/clicks）
- `post_features`: 抽出済み特徴
- `inspirations`: 業界バズ投稿
- `recent_knowledge`: 最新ナレッジサマリー

### 3. 分析

`/tmp/cc-export.json` を読み込み、以下を抽出:
- **winners**: 24h views が上位30% の投稿
- **losers**: 24h views が下位25% の投稿  
- **inspirations の特徴**: 文字数・絵文字・冒頭問いかけ等の傾向

### 4. 生成（4投稿）

**配分**（厳守）:
- ジャンル: 西洋占星術50% / 四柱推命20% / 紫微斗数15% / 易経15%
- コンテンツタイプ: 共感40% / 豆知識25% / 運勢20% / ストーリー10% / CTA5%
- 文体: 「〜だよ」基調、CTAだけ丁寧語
- 文字数: 200〜450字
- 禁止語: 「絶対」「100%」「必ず」「確実」

**時刻**（JST）:
- 12:15 → 共感系 or 豆知識
- 18:00 → ストーリー or 豆知識
- 21:30 → 共感 or 運勢
- 23:45 → CTA（週2-3回）or 共感

各投稿を以下の形式で:
```json
{
  "scheduled_at": "2026-05-02T03:15:00.000Z",
  "body": "投稿本文...",
  "genre": "astrology",
  "content_type": "empathy",
  "has_cta": false,
  "cta_target_url": null
}
```

### 5. ユーザー確認

生成した4投稿のプレビューをユーザーに表示し、修正点があるか聞く。修正があれば反映。

### 6. POST /api/cc/posts-bulk

```bash
curl -k -X POST \
  -H "Authorization: Bearer $CC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"posts": [...]}' \
  https://localhost:3001/api/cc/posts-bulk
```

### 7. 結果報告

投入された投稿のID・時刻をユーザーに報告して完了。

## 注意

- 過去のwinnersのトーン・構成を踏襲
- losersのパターン（用語多すぎ・文字数長すぎ等）を回避
- inspirations の業界傾向を反映
- 占術倫理（断定表現NG）を厳守
