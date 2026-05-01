@AGENTS.md

# 占いThreads管理ツール（threads-mgr）

## このプロジェクトは何

ゆやさん運営の占いアカウント（西洋占星術＋四柱推命＋紫微斗数＋易経）のThreads投稿を半自動化するツール。最終KPIは「Threadsで集客→公式LINEで無料鑑定依頼を集めること」。自分専用ダッシュボード（外部公開なし）。

詳細設計プラン: `/Users/nagasawayuuya/.claude/plans/threads-web-eager-chipmunk.md`

## 技術スタック

- Next.js 16 (App Router) on Vercel
- Supabase (PostgreSQL, Free tier)
- Tailwind CSS v4 + TypeScript
- AI生成: Claude Code経由（Anthropic API課金なし、Maxプラン定額内）

## 投稿ルール

### 時刻スロット (JST)
- 朝7:30 / 昼12:15 / 夕18:00 / 夜21:30 / 深夜23:45

### ジャンル配分
- 西洋占星術 50%
- 四柱推命 20%
- 紫微斗数 15%
- 易経 15%

### コンテンツタイプ配分
- 共感系 40%
- 豆知識系 25%
- 今日の運勢 20%
- ストーリー型 10%
- CTA投稿 5%（週2〜3回ガッツリ）

### 文体
- 平常時:「〜だよ」のフレンドリー基調
- CTA: 丁寧語に切替

### 文字数目安
- 200〜450字

### 禁止語（占術倫理＋プラットフォーム規約）
- 「絶対」「100%」「必ず」「確実」など断定表現

## ハイブリッド運用フロー

ゆやさんが Claude Code を起動して AI 生成する設計（API課金回避）:

- **寝る前5分**: `/tomorrow-morning` で翌朝7:30投稿1本生成
- **起床時10分**: `/today-rest` で今日の昼/夕/夜/深夜4投稿生成
- **週1日曜5分**: `/analyze-inspirations` でバズ投稿のナレッジ化

サーバー（Vercel）は AI に触らない:
- Vercel cron 毎分: 予約時刻が来た投稿を Threads API で発射
- Vercel cron 毎時: 投稿のメトリクス取得
- Vercel cron 毎朝5時: 占いキーワードでバズ投稿を自動収集

## ディレクトリ構造（実装中）

```
src/
  app/                # App Router pages / layouts / route handlers
    (dashboard)/      # 認証ガード付きダッシュボード
    api/              # API Routes
    cron/             # Vercel Cron 用エンドポイント
    oauth/            # Threads OAuth
  lib/
    supabase/         # Supabase client (server / browser)
    threads/          # Threads API ラッパ
    auth/             # パスワード認証セッション
    crypto.ts         # AES-GCM トークン暗号化
  components/         # React UI components
supabase/
  migrations/         # SQL マイグレーション
```

## 開発時の注意

- **Next.js 16 系のため、AI訓練データと実装が違う可能性あり**
- 必ず `node_modules/next/dist/docs/` の最新ドキュメントを参照する
- Server Actions / Route Handlers / cookies API は最新パターンに従う
- params は Next.js 15+ から Promise（`await ctx.params`）

## 現在の進行フェーズ

**Phase 1 (MVP)**: プロジェクト初期化 → Threads OAuth → 投稿発射 cron → メトリクス取得 cron → ダッシュボード最小版
