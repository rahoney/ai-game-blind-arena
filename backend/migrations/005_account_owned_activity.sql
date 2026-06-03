-- Account system phase 5: account-owned activity and profile badge storage.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS profile_badge_key TEXT;

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS profile_display_name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS unique_evaluations_user_model
ON evaluations (user_id, game_type, actual_model_name)
WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evaluations_user_id
ON evaluations (user_id);

CREATE TABLE IF NOT EXISTS user_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    display_name TEXT,
    game_type TEXT NOT NULL,
    actual_model_name TEXT NOT NULL,
    viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_views_user_id
ON user_views (user_id);

CREATE INDEX IF NOT EXISTS idx_user_views_user_game_type
ON user_views (user_id, game_type);

CREATE INDEX IF NOT EXISTS idx_user_views_user_model
ON user_views (user_id, actual_model_name);

CREATE TABLE IF NOT EXISTS comment_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    profile_display_name TEXT NOT NULL,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE comment_reactions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS profile_display_name TEXT;

CREATE INDEX IF NOT EXISTS idx_comment_reactions_evaluation_id
ON comment_reactions (evaluation_id);

CREATE UNIQUE INDEX IF NOT EXISTS unique_comment_reactions_user
ON comment_reactions (evaluation_id, user_id);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id
ON comment_reactions (user_id);

CREATE TABLE IF NOT EXISTS comment_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    profile_display_name TEXT NOT NULL,
    reply TEXT NOT NULL CHECK (length(reply) <= 150),
    is_blinded BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE comment_replies
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS profile_display_name TEXT;

CREATE INDEX IF NOT EXISTS idx_comment_replies_evaluation_id
ON comment_replies (evaluation_id);

CREATE INDEX IF NOT EXISTS idx_comment_replies_user_id
ON comment_replies (user_id);

COMMENT ON COLUMN profiles.profile_badge_key IS 'Selected profile badge for account-owned profile rendering.';
COMMENT ON COLUMN evaluations.user_id IS 'Account owner for evaluations.';
COMMENT ON COLUMN evaluations.profile_display_name IS 'Display name snapshot for account-owned evaluations.';
COMMENT ON TABLE user_views IS 'Per-account game/model view history.';
COMMENT ON COLUMN comment_reactions.user_id IS 'Account owner for comment reactions.';
COMMENT ON COLUMN comment_replies.user_id IS 'Account owner for comment replies.';
