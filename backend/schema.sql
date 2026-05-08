-- Supabase Schema for LLM Game Evaluator

-- 1. Create nicknames table
CREATE TABLE nicknames (
    nickname TEXT PRIMARY KEY,
    profile_badge_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create evaluations table
CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nickname TEXT NOT NULL REFERENCES nicknames(nickname) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    game_type TEXT NOT NULL,
    actual_model_name TEXT NOT NULL,
    blind_model_id TEXT NOT NULL,
    score_control INTEGER CHECK (score_control >= 1 AND score_control <= 10),
    score_structure INTEGER CHECK (score_structure >= 1 AND score_structure <= 10),
    score_presentation INTEGER CHECK (score_presentation >= 1 AND score_presentation <= 10),
    score_difficulty INTEGER CHECK (score_difficulty >= 1 AND score_difficulty <= 10),
    score_fun INTEGER CHECK (score_fun >= 1 AND score_fun <= 10),
    score_overall INTEGER CHECK (score_overall >= 1 AND score_overall <= 10),
    total_score INTEGER,
    comment TEXT CHECK (length(comment) <= 150),
    is_blinded BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure a user can only have one active evaluation per game & actual model (for upsert)
ALTER TABLE evaluations ADD CONSTRAINT unique_user_eval UNIQUE (nickname, game_type, actual_model_name);

-- 3. Create game_stats table to track play counts
CREATE TABLE game_stats (
    game_type TEXT NOT NULL,
    actual_model_name TEXT NOT NULL,
    plays INTEGER DEFAULT 0,
    PRIMARY KEY (game_type, actual_model_name)
);

-- 4. Create nickname_views table to track per-nickname view history
CREATE TABLE nickname_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nickname TEXT NOT NULL REFERENCES nicknames(nickname) ON DELETE CASCADE,
    game_type TEXT NOT NULL,
    actual_model_name TEXT NOT NULL,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_nickname_views_nickname ON nickname_views (nickname);
CREATE INDEX idx_nickname_views_nickname_game_type ON nickname_views (nickname, game_type);
CREATE INDEX idx_nickname_views_nickname_model ON nickname_views (nickname, actual_model_name);

-- 5. Create comment_reactions table for like/dislike toggles
CREATE TABLE comment_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL REFERENCES nicknames(nickname) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_comment_reaction UNIQUE (evaluation_id, nickname)
);

CREATE INDEX idx_comment_reactions_evaluation_id ON comment_reactions (evaluation_id);
CREATE INDEX idx_comment_reactions_nickname ON comment_reactions (nickname);
CREATE INDEX idx_evaluations_nickname ON evaluations (nickname);
CREATE INDEX idx_evaluations_game_type ON evaluations (game_type);
CREATE INDEX idx_evaluations_model ON evaluations (actual_model_name);

-- 6. Create comment_replies table for first-level replies only
CREATE TABLE comment_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL REFERENCES nicknames(nickname) ON DELETE CASCADE,
    reply TEXT NOT NULL CHECK (length(reply) <= 150),
    is_blinded BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comment_replies_evaluation_id ON comment_replies (evaluation_id);
CREATE INDEX idx_comment_replies_nickname ON comment_replies (nickname);

-- Note: Ensure Row Level Security (RLS) is configured correctly in Supabase.
-- For a public-facing API backend with a service key or anon key, you may need to:
-- ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable full access for anon" ON evaluations FOR ALL USING (true);
-- (Or just disable RLS if you only access via backend with Service Role Key)
