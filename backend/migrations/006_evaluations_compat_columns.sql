-- Account system phase 6: align deployed evaluations table with backend writes.
-- Some deployed databases have a reduced evaluations table. These columns are
-- the full write/read surface used by backend/main.py.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS nickname TEXT,
ADD COLUMN IF NOT EXISTS ip_address TEXT,
ADD COLUMN IF NOT EXISTS game_type TEXT,
ADD COLUMN IF NOT EXISTS actual_model_name TEXT,
ADD COLUMN IF NOT EXISTS blind_model_id TEXT,
ADD COLUMN IF NOT EXISTS score_control INTEGER,
ADD COLUMN IF NOT EXISTS score_structure INTEGER,
ADD COLUMN IF NOT EXISTS score_presentation INTEGER,
ADD COLUMN IF NOT EXISTS score_difficulty INTEGER,
ADD COLUMN IF NOT EXISTS score_fun INTEGER,
ADD COLUMN IF NOT EXISTS score_overall INTEGER,
ADD COLUMN IF NOT EXISTS total_score INTEGER,
ADD COLUMN IF NOT EXISTS comment TEXT,
ADD COLUMN IF NOT EXISTS is_blinded BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS profile_display_name TEXT;

CREATE INDEX IF NOT EXISTS idx_evaluations_game_type
ON evaluations (game_type);

CREATE INDEX IF NOT EXISTS idx_evaluations_model
ON evaluations (actual_model_name);

CREATE INDEX IF NOT EXISTS idx_evaluations_nickname
ON evaluations (nickname);

CREATE INDEX IF NOT EXISTS idx_evaluations_user_id
ON evaluations (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS unique_evaluations_legacy_nickname_model
ON evaluations (nickname, game_type, actual_model_name)
WHERE user_id IS NULL AND nickname IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_evaluations_user_model
ON evaluations (user_id, game_type, actual_model_name)
WHERE user_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
