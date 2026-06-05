-- Supabase schema for VeilPlays account-owned activity.
-- Legacy display-name login tables are intentionally not part of this schema.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL UNIQUE,
    login_id TEXT UNIQUE,
    real_name TEXT,
    display_name TEXT NOT NULL,
    display_name_set BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    provider TEXT,
    social_providers TEXT[] NOT NULL DEFAULT '{}',
    email TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_required BOOLEAN NOT NULL DEFAULT TRUE,
    account_status TEXT NOT NULL DEFAULT 'active',
    profile_badge_key TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX unique_profiles_display_name_ci
ON profiles (LOWER(display_name));

CREATE UNIQUE INDEX unique_profiles_login_id_ci
ON profiles (LOWER(login_id))
WHERE login_id IS NOT NULL;

CREATE TABLE auth_provider_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    provider_display_name TEXT,
    provider_avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_auth_provider_account UNIQUE (provider, provider_user_id),
    CONSTRAINT unique_profile_provider UNIQUE (profile_id, provider)
);

CREATE INDEX idx_auth_provider_accounts_profile_id
ON auth_provider_accounts (profile_id);

CREATE INDEX idx_auth_provider_accounts_provider_email
ON auth_provider_accounts (provider, provider_email)
WHERE provider_email IS NOT NULL;

CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    profile_display_name TEXT NOT NULL,
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_evaluations_user_model UNIQUE (user_id, game_type, actual_model_name)
);

CREATE INDEX idx_evaluations_user_id ON evaluations (user_id);
CREATE INDEX idx_evaluations_game_type ON evaluations (game_type);
CREATE INDEX idx_evaluations_model ON evaluations (actual_model_name);
CREATE INDEX idx_evaluations_profile_display_name ON evaluations (profile_display_name);

CREATE TABLE game_stats (
    game_type TEXT NOT NULL,
    actual_model_name TEXT NOT NULL,
    plays INTEGER DEFAULT 0,
    PRIMARY KEY (game_type, actual_model_name)
);

CREATE TABLE user_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    display_name TEXT,
    game_type TEXT NOT NULL,
    actual_model_name TEXT NOT NULL,
    viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_views_user_id ON user_views (user_id);
CREATE INDEX idx_user_views_user_game_type ON user_views (user_id, game_type);
CREATE INDEX idx_user_views_user_model ON user_views (user_id, actual_model_name);
CREATE INDEX idx_user_views_display_name ON user_views (display_name);

CREATE TABLE comment_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    profile_display_name TEXT NOT NULL,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_comment_reactions_user UNIQUE (evaluation_id, user_id)
);

CREATE INDEX idx_comment_reactions_evaluation_id ON comment_reactions (evaluation_id);
CREATE INDEX idx_comment_reactions_user_id ON comment_reactions (user_id);

CREATE TABLE comment_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    profile_display_name TEXT NOT NULL,
    reply TEXT NOT NULL CHECK (length(reply) <= 150),
    is_blinded BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comment_replies_evaluation_id ON comment_replies (evaluation_id);
CREATE INDEX idx_comment_replies_user_id ON comment_replies (user_id);
CREATE INDEX idx_comment_replies_profile_display_name ON comment_replies (profile_display_name);
