---
description: 業界バズ投稿のナレッジ化（週1日曜推奨）
---

# /analyze-inspirations

`inspirations` テーブルの過去データを分析し、業界バズ投稿の共通特徴を抽出してナレッジ化する。

## 実行手順

### 1. データ取得

```bash
source <(grep -v '^#' .env.local | sed 's/^/export /')
curl -k -s -H "Authorization: Bearer $CC_API_KEY" \
  "https://localhost:3001/api/cc/inspirations-export?days=30" \
  > /tmp/cc-export.json
```

`inspirations` 配列を中心に分析。

### 2. 特徴抽出

各 inspiration から:
- 文字数（中央値・分布）
- 絵文字数（平均・最頻）
- ハッシュタグ使用頻度
- 冒頭パターン（問いかけ / 共感 / 宣言 等）
- 文体（やさしい / 凛とした / エンタメ）
- 末尾パターン（共感フレーズ / CTA / 問いかけ）
- 頻出キーワード Top 20

### 3. ナレッジサマリー生成

```json
{
  "version": <最新version+1>,
  "summary_json": {
    "sample_size": 200,
    "body_length": { "median": 280, "p25": 200, "p75": 380 },
    "emoji_count": { "median": 4, "p25": 2, "p75": 6 },
    "opening_patterns": [
      { "type": "question", "ratio": 0.45 },
      { "type": "empathy", "ratio": 0.30 }
    ],
    "tone_distribution": { "soft": 0.55, "firm": 0.25, "entertainment": 0.20 },
    "top_keywords": ["水星逆行", "天秤座", "命式", "癸水", "..."],
    "do": ["冒頭で問いかけ", "絵文字3-5個", "末尾に共感"],
    "dont": ["文字数500字超", "ハッシュタグ5個以上", "断定表現"]
  }
}
```

### 4. DB保存

```bash
# Supabase JS で直接INSERT（service_role）
node --env-file=.env.local -e "
import { createClient } from '@supabase/supabase-js';
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
await s.from('knowledge').insert({
  summary_json: { ... },
  version: <next>,
});
"
```

### 5. ユーザーレポート

抽出されたナレッジを Markdown 形式でユーザーに表示:

```markdown
## 占い界隈バズ投稿の傾向 (過去30日, n=200)

### Do
- 冒頭で問いかけ (45%)
- 絵文字3-5個 (中央値4)
- 文字数250-350字
- 末尾に共感フレーズ

### Don't
- 文字数500字超
- ハッシュタグ5個以上
- 断定表現

### 頻出キーワード TOP 10
1. 水星逆行
2. 天秤座
...
```

このナレッジは次回以降の `/today-rest` `/tomorrow-morning` で自動的にプロンプトに組み込まれる。
