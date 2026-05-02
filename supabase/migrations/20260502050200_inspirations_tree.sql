-- inspirations テーブル拡張: ツリー投稿対応 + Playwright スクレイピング状態管理

ALTER TABLE inspirations
  ADD COLUMN IF NOT EXISTS tree_id uuid,
  ADD COLUMN IF NOT EXISTS tree_position integer,
  ADD COLUMN IF NOT EXISTS scrape_status text NOT NULL DEFAULT 'pending'
    CHECK (scrape_status IN ('pending', 'scraping', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS scrape_error text,
  ADD COLUMN IF NOT EXISTS scrape_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes_count integer,
  ADD COLUMN IF NOT EXISTS replies_count integer,
  ADD COLUMN IF NOT EXISTS reposts_count integer,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_inspirations_tree
  ON inspirations(tree_id, tree_position)
  WHERE tree_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inspirations_scrape_status
  ON inspirations(scrape_status, registered_at);
