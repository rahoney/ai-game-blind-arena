-- Remove legacy nickname-login activity compatibility.
-- Run this after the application has been deployed with account-only activity writes.

ALTER TABLE evaluations
ADD COLUMN IF NOT EXISTS profile_display_name TEXT;

ALTER TABLE comment_reactions
ADD COLUMN IF NOT EXISTS profile_display_name TEXT;

ALTER TABLE comment_replies
ADD COLUMN IF NOT EXISTS profile_display_name TEXT;

ALTER TABLE user_views
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- New account-owned rows should always have a profile display-name snapshot.
UPDATE evaluations
SET profile_display_name = COALESCE(profile_display_name, nickname)
WHERE profile_display_name IS NULL
  AND nickname IS NOT NULL;

UPDATE comment_reactions
SET profile_display_name = COALESCE(profile_display_name, nickname)
WHERE profile_display_name IS NULL
  AND nickname IS NOT NULL;

UPDATE comment_replies
SET profile_display_name = COALESCE(profile_display_name, nickname)
WHERE profile_display_name IS NULL
  AND nickname IS NOT NULL;

UPDATE user_views uv
SET display_name = p.display_name
FROM profiles p
WHERE uv.user_id = p.id
  AND uv.display_name IS NULL;

-- Drop legacy nickname-only uniqueness and lookup objects.
ALTER TABLE evaluations
DROP CONSTRAINT IF EXISTS unique_user_eval;

DROP INDEX IF EXISTS unique_user_eval;
DROP INDEX IF EXISTS unique_evaluations_legacy_nickname_model;
DROP INDEX IF EXISTS unique_comment_reactions_legacy_nickname;
DROP INDEX IF EXISTS idx_evaluations_nickname;
DROP INDEX IF EXISTS idx_comment_reactions_nickname;
DROP INDEX IF EXISTS idx_comment_replies_nickname;

-- Remove legacy nickname-only tables.
DROP TABLE IF EXISTS nickname_views CASCADE;
DROP TABLE IF EXISTS nicknames CASCADE;

-- These columns are no longer used for login or display. Keep profile_display_name instead.
ALTER TABLE evaluations
DROP COLUMN IF EXISTS nickname;

ALTER TABLE comment_reactions
DROP COLUMN IF EXISTS nickname;

ALTER TABLE comment_replies
DROP COLUMN IF EXISTS nickname;

CREATE INDEX IF NOT EXISTS idx_evaluations_profile_display_name
ON evaluations (profile_display_name);

CREATE INDEX IF NOT EXISTS idx_comment_replies_profile_display_name
ON comment_replies (profile_display_name);

CREATE INDEX IF NOT EXISTS idx_user_views_display_name
ON user_views (display_name);

NOTIFY pgrst, 'reload schema';
