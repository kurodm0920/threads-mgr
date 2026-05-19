-- inspirations に views_count を追加（バズ判定 = engagement_rate >= 5%）

ALTER TABLE inspirations
  ADD COLUMN IF NOT EXISTS views_count integer;
