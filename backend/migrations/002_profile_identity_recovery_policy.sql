-- Account system phase 2: profile identity, recovery, and social-linking policy.
-- Run this after 001_account_profiles.sql.

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS login_id TEXT,
ADD COLUMN IF NOT EXISTS real_name TEXT,
ADD COLUMN IF NOT EXISTS display_name_set BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_verification_required BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS social_providers JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'email_unverified', 'dormant', 'withdrawn', 'admin_disabled'));

CREATE UNIQUE INDEX IF NOT EXISTS unique_profiles_login_id_ci
ON profiles (LOWER(login_id))
WHERE login_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_profiles_display_name_ci
ON profiles (LOWER(display_name));

CREATE INDEX IF NOT EXISTS idx_profiles_real_name ON profiles (real_name);
CREATE INDEX IF NOT EXISTS idx_profiles_last_login_at ON profiles (last_login_at);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles (account_status);

CREATE TABLE IF NOT EXISTS account_recovery_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recovery_type TEXT NOT NULL CHECK (recovery_type IN ('find_login_id', 'reset_password')),
    identifier_hash TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_recovery_attempts_lookup
ON account_recovery_attempts (recovery_type, identifier_hash, ip_address, created_at DESC);

COMMENT ON COLUMN profiles.login_id IS 'User-chosen login ID. Never returned in full to the browser during recovery.';
COMMENT ON COLUMN profiles.real_name IS 'User-provided account recovery name. Do not display publicly.';
COMMENT ON COLUMN profiles.display_name IS 'Public display nickname used on evaluations and comments. Not used for login.';
COMMENT ON COLUMN profiles.display_name_set IS 'True when the user explicitly completed display nickname setup.';
COMMENT ON COLUMN profiles.email_verification_required IS 'True while core features should be restricted until Firebase email verification is complete.';
COMMENT ON COLUMN profiles.last_login_at IS 'Updated on successful login for dormant-account or deletion policy.';
COMMENT ON COLUMN profiles.social_providers IS 'Linked social providers for the same Firebase uid.';
COMMENT ON TABLE account_recovery_attempts IS 'Rate-limit and audit table for account recovery attempts. Lock out after 5 failures within 10 minutes.';
