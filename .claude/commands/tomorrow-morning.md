---
description: 翌朝7:30の投稿1本を生成して予約
---

# /tomorrow-morning

翌朝7:30 JST の投稿1本を生成・予約する（寝る前の作業）。

## 実行手順

### 1. データ取得
`/today-rest` と同様に `/api/cc/inspirations-export?days=7` で取得。

### 2. 分析
今日までの全数値を反映して winners/losers 把握。

### 3. 生成（1投稿）

**特性**:
- 朝7:30はThreadsの活発時間帯、フォロワー以外にも届きやすい
- 「今日の運勢」「今日のヒント」系がハマりやすい
- 文字数250〜350字推奨
- 絵文字3〜5個

**配分指針**:
- 西洋占星術50%・四柱推命20%・紫微斗数15%・易経15%（曜日ローテで均等化）
- コンテンツタイプは「運勢」「共感」「豆知識」のいずれか
- CTA は朝には基本入れない

### 4. ユーザー確認

生成案を1つ提示。修正あれば反映。

### 5. POST

```bash
curl -k -X POST \
  -H "Authorization: Bearer $CC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"posts": [{
    "scheduled_at": "...T22:30:00.000Z",
    "body": "...",
    "genre": "astrology",
    "content_type": "fortune",
    "has_cta": false
  }]}' \
  https://localhost:3001/api/cc/posts-bulk
```

`scheduled_at` は **翌日朝7:30 JST** を UTC に変換（= 前日22:30 UTC）。
