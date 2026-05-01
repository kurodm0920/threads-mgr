-- 占いThreads管理ツール: 初期スキーマ

-- ==============================================
-- accounts: Threadsアカウント情報
-- ==============================================
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  threads_user_id text UNIQUE,
  threads_username text,
  access_token_enc text,
  access_token_iv text,
  token_expires_at timestamptz,
  refreshed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================
-- scheduled_posts: 予約投稿
-- ==============================================
CREATE TABLE scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  body text NOT NULL,
  media_urls jsonb,
  genre text CHECK (genre IN ('astrology', 'shichu', 'shibun', 'iching', 'general')),
  content_type text CHECK (content_type IN ('empathy', 'tips', 'fortune', 'story', 'cta')),
  has_cta boolean NOT NULL DEFAULT false,
  cta_target_url text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'publishing', 'published', 'failed', 'canceled')),
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  generated_by text CHECK (generated_by IN ('claude_code', 'manual')),
  generation_batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_scheduled_due ON scheduled_posts(status, scheduled_at);
CREATE INDEX idx_scheduled_account ON scheduled_posts(account_id, scheduled_at);

-- ==============================================
-- published_posts: 投稿済み
-- ==============================================
CREATE TABLE published_posts (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  threads_media_id text NOT NULL,
  permalink text,
  body_snapshot text NOT NULL,
  genre text,
  content_type text,
  has_cta boolean NOT NULL DEFAULT false,
  cta_target_url text,
  scheduled_at timestamptz NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_published_account_time ON published_posts(account_id, published_at DESC);

-- ==============================================
-- post_metrics: 数値（時系列バケット）
-- ==============================================
CREATE TABLE post_metrics (
  post_id uuid NOT NULL REFERENCES published_posts(id) ON DELETE CASCADE,
  bucket text NOT NULL CHECK (bucket IN ('1h', '3h', '24h', '3d', '7d', 'latest')),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  replies integer NOT NULL DEFAULT 0,
  reposts integer NOT NULL DEFAULT 0,
  quotes integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, bucket)
);
CREATE INDEX idx_metrics_post_time ON post_metrics(post_id, fetched_at);

-- ==============================================
-- post_features: 投稿の特徴
-- ==============================================
CREATE TABLE post_features (
  post_id uuid PRIMARY KEY REFERENCES published_posts(id) ON DELETE CASCADE,
  body_length integer,
  emoji_count integer,
  hashtag_count integer,
  newline_count integer,
  question_count integer,
  has_cta boolean,
  has_url boolean,
  cta_position text CHECK (cta_position IN ('top', 'middle', 'bottom', 'none')),
  keywords_json jsonb,
  tone text CHECK (tone IN ('soft', 'firm', 'entertainment')),
  decided_by text CHECK (decided_by IN ('rule', 'claude_code')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================
-- inspirations: 参考バズ投稿（自動収集 + 手動登録）
-- ==============================================
CREATE TABLE inspirations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('auto_search', 'manual')),
  source_url text,
  threads_post_id text,
  account_handle text,
  body text,
  keyword_matched text,
  popularity_rank integer,
  registered_at timestamptz NOT NULL DEFAULT now(),
  my_notes text,
  tags jsonb
);
CREATE INDEX idx_inspirations_source ON inspirations(source, registered_at DESC);
CREATE INDEX idx_inspirations_keyword ON inspirations(keyword_matched, registered_at DESC);

-- ==============================================
-- knowledge: ナレッジサマリー（週次更新）
-- ==============================================
CREATE TABLE knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  derived_at timestamptz NOT NULL DEFAULT now(),
  summary_json jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1
);
CREATE INDEX idx_knowledge_latest ON knowledge(derived_at DESC);

-- ==============================================
-- daily_account_stats: 日次集計（フォロワー推移など）
-- ==============================================
CREATE TABLE daily_account_stats (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date date NOT NULL,
  followers_count integer,
  following_count integer,
  posts_count integer,
  total_views integer,
  total_likes integer,
  total_replies integer,
  total_clicks integer,
  PRIMARY KEY (account_id, date)
);

-- ==============================================
-- line_conversions: LINE誘導（友だち追加・依頼数の手動入力）
-- ==============================================
CREATE TABLE line_conversions (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date date NOT NULL,
  friends_added integer NOT NULL DEFAULT 0,
  consultations integer NOT NULL DEFAULT 0,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, date)
);

-- ==============================================
-- sessions: ダッシュボード認証セッション
-- ==============================================
CREATE TABLE sessions (
  token text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
