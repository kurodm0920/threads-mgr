---
description: 過去7日の投稿パフォーマンスをまとめて報告
---

# /weekly-review

過去7日の投稿パフォーマンスを分析し、ユーザーに週次レポートを提示する。

## 実行手順

### 1. データ取得

```bash
source <(grep -v '^#' .env.local | sed 's/^/export /')
curl -k -s -H "Authorization: Bearer $CC_API_KEY" \
  "https://localhost:3001/api/cc/inspirations-export?days=7" \
  > /tmp/cc-export.json
```

### 2. 集計

- 総投稿数
- 総views / 総いいね / 総返信 / 総clicks
- ジャンル別のviews平均
- コンテンツタイプ別の views 平均
- winners (上位30%) と losers (下位25%) の特定
- 時間帯別パフォーマンス

### 3. レポート出力

Markdown形式でユーザーに表示:

```markdown
# 週次レポート (YYYY-MM-DD 〜 YYYY-MM-DD)

## サマリ
- 投稿数: 35件
- 総views: 28,450
- 総いいね: 1,240
- LINE誘導クリック: 87 (CTA投稿のみ)

## ジャンル別
| ジャンル | 投稿数 | 平均views | 平均いいね率 |
|---|---|---|---|
| 西洋占星術 | 18 | 850 | 5.2% |
| 四柱推命 | 7 | 920 | 4.8% |
| ...

## TOP 5 winners
1. [西洋占星術/共感系/12:15] views=1240 ❤️率8% 「...」
2. ...

## ワースト 3 losers
1. [四柱推命/豆知識/18:00] views=420 「...」
   → 専門用語多すぎ説
2. ...

## 改善提案
- 朝7:30の運勢系がハマってる、来週も継続推奨
- 18:00の豆知識系は文字数を200字以下に絞る方が良さそう
- CTAは21:30より23:45の方がクリック率高い
```

### 4. 改善メモを `knowledge` に追記（任意）

レポート内容をベースに、来週の改善方針を `knowledge.summary_json.weekly_notes` に追記。
