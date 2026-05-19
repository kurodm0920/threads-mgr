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
- 平常時: ですます調、絵文字なし
- CTA: 丁寧語のまま
- **末尾の署名（「志麻」など）は入れない**（2026-05-19変更）

### 文字数目安
- 200〜450字

### 禁止語（占術倫理＋プラットフォーム規約）
- 「絶対」「100%」「必ず」「確実」など断定表現

### CTA投稿のルール（重要）
- **外部URLの直貼りは禁止**（Threads の垢BANリスク回避）
- LINE 公式アカウントへの誘導は「**プロフィールから**」と書いてプロフ遡求型にする
- 例: 「プロフィールのリンクから LINE にお越しください」「詳しくはプロフィールへ」
- `scheduled_posts.cta_target_url` は null のまま運用（DB に URL は保存しない）
- ただし `has_cta=true` は記録の意味で立てる（あとで分析時にCTA投稿を判別できるように）

### 画像つき投稿の運用
- バズ分析結果（2026-05-19）で「バズ投稿の60%は画像付き」と判明
- `public/buzz-images/` に幸運系画像を常備（ChatGPT 生成、現在5枚）:
  - `moon-ocean.png` — 海上の満月
  - `shrine-morning-light.png` — 朝光が差す神社
  - `torii-sunset.png` — 海に浮かぶ鳥居と夕焼け
  - `golden-buddha.png` — 金の仏像
  - `dragon-cloud.png` — 龍雲
- `/generate-week` で週35投稿のうち **5〜7投稿は画像つき** で生成（ランダム選択）
- 画像URL形式: `https://threads-mgr.vercel.app/buzz-images/<filename>`
- 投稿時刻が来ると `/cron/publish` が Threads API の IMAGE タイプで自動配信
- 画像追加したい場合: `public/buzz-images/` に jpg/png を置いて `src/lib/buzz-images.ts` の `BUZZ_IMAGES` 配列に追記

## ハイブリッド運用フロー

ゆやさんが Claude Code を起動して AI 生成する設計（API課金回避）:

- **週1日曜夜20〜30分**: `/generate-week` で翌週月〜日の35投稿（7日×5スロット）を一括生成
- **週末や月1**: `/analyze-inspirations` でバズ投稿のナレッジ化（任意）
- **任意のタイミング**: `/discover-trends` で占い系トレンド投稿を自動収集（Playwright on GitHub Actions）
- **個別差し替え（必要時）**: ダッシュボードの `/drafts` ページから予約済み投稿を直接編集

サーバー（Vercel + GitHub Actions）は AI に触らない:
- GitHub Actions 5分ごと: 予約時刻が来た投稿を Threads API で発射 + 投稿メトリクス取得
- GitHub Actions 5分ごと: 参考投稿リストの本文・いいね数を Playwright でスクレイピング
- GitHub Actions 手動起動: `/discover-trends` から呼ばれる占い系キーワードのトレンド探索

## トレンド投稿の集め方と使い方

### どうやって集めるか

`/discover-trends` というコマンドを Claude Code で打つと、占い系のキーワード10個（西洋占星術・四柱推命・水星逆行など）で Threads を自動検索し、人気上位の投稿を最大100件まとめて取ってきます。

集めた投稿は、ダッシュボードの「参考投稿」ページの「トレンド」タブに本文・いいね数つきで並びます。10〜15分で反映されます。

### 集めた投稿は次の投稿づくりにどう活きるか

**追加作業なしで2段階に効きます。**

#### ① そのまま参考にされる（自動）

毎日の `/today-rest`（昼〜深夜4投稿の生成）と `/tomorrow-morning`（翌朝の投稿1本生成）を実行したとき、ツールは過去7日分の参考投稿（手動で登録したもの＋トレンドで集めたもの両方）を読み込んだうえで投稿案を作ります。

つまり「いま占い界隈でこういう書き出しがウケてる」「このキーワードはこんな切り口が刺さってる」というのを、AI が見ながら新しい投稿を組み立てます。

これは Claude が毎回自動でやるので、ゆやさんが追加で何かする必要はありません。

#### ② 傾向をまとめてさらに反映（任意・週末などに）

`/analyze-inspirations` を打つと、集まった投稿全部を分析して、共通する特徴を「やった方がいい」「やらない方がいい」のリストにまとめます（例: 「冒頭で問いかけるとウケる」「絵文字は0〜2個までが主流」など）。

このまとめは保存されて、次回以降の投稿作成時に毎回自動で参照されます。

①が「お手本そのものを見せる」、②が「お手本から抽出したコツを教える」イメージです。

### おすすめの使い方

| いつ | 何をする | 効果 |
|---|---|---|
| トレンドを集めた直後 | 特に何もしなくてOK | 次の投稿生成で自動で参考にされる |
| 週末や月1くらい | `/analyze-inspirations` を打つ | 傾向まとめが更新され、生成品質が底上げされる |

### 注意点

- トレンド探索は **Threads ToS グレー** なので、週1〜月数回程度の低頻度運用が安全
- 集まる投稿に占い以外が混ざる可能性あり（検索結果の仕組み上）。`/analyze-inspirations` 側で Claude がフィルタする
- 失敗時は GitHub Actions ログ（https://github.com/kurodm0920/threads-mgr/actions ）で確認

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
