-- inspirations に画像/動画の有無を保存

ALTER TABLE inspirations
  ADD COLUMN IF NOT EXISTS image_count integer,
  ADD COLUMN IF NOT EXISTS has_image boolean,
  ADD COLUMN IF NOT EXISTS has_video boolean;
