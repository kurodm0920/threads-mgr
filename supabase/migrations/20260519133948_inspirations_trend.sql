-- inspirations テーブル拡張: トレンドキーワード探索（Phase 3.5）

-- 1. source の CHECK 制約に 'keyword_trend' を追加
ALTER TABLE inspirations
  DROP CONSTRAINT IF EXISTS inspirations_source_check;
ALTER TABLE inspirations
  ADD CONSTRAINT inspirations_source_check
  CHECK (source IN ('auto_search', 'manual', 'keyword_trend'));

-- 2. 新規カラム
ALTER TABLE inspirations
  ADD COLUMN IF NOT EXISTS discovered_at timestamptz,
  ADD COLUMN IF NOT EXISTS search_rank integer;

-- 3. source_url の重複排除（部分 UNIQUE インデックス、NULL は許容）
CREATE UNIQUE INDEX IF NOT EXISTS idx_inspirations_source_url_unique
  ON inspirations(source_url)
  WHERE source_url IS NOT NULL;

-- 4. トレンド一覧の表示用インデックス
CREATE INDEX IF NOT EXISTS idx_inspirations_trend_discovered
  ON inspirations(discovered_at DESC)
  WHERE source = 'keyword_trend';
