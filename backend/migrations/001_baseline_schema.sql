-- VeilPlays Supabase baseline schema.
-- Use this file for a new environment. Run it once in the Supabase SQL editor.
-- Historical patch migrations were consolidated into this baseline on 2026-07-01.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL UNIQUE,
    login_id TEXT,
    real_name TEXT,
    display_name TEXT NOT NULL,
    display_name_set BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'admin', 'super_admin')),
    provider TEXT,
    social_providers JSONB NOT NULL DEFAULT '[]'::jsonb,
    email TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_required BOOLEAN NOT NULL DEFAULT TRUE,
    account_status TEXT NOT NULL DEFAULT 'active'
        CHECK (account_status IN ('active', 'email_unverified', 'dormant', 'withdrawn', 'admin_disabled', 'deleted')),
    profile_badge_key TEXT,
    terms_accepted_at TIMESTAMP WITH TIME ZONE,
    privacy_accepted_at TIMESTAMP WITH TIME ZONE,
    policy_version TEXT,
    display_name_changed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_profiles_login_id_ci
ON public.profiles (LOWER(login_id))
WHERE login_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_profiles_display_name_ci
ON public.profiles (LOWER(display_name));

CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON public.profiles (firebase_uid);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_real_name ON public.profiles (real_name);
CREATE INDEX IF NOT EXISTS idx_profiles_last_login_at ON public.profiles (last_login_at);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles (account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_policy_version ON public.profiles (policy_version);

CREATE TABLE IF NOT EXISTS public.account_recovery_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recovery_type TEXT NOT NULL
        CHECK (recovery_type IN ('find_login_id', 'send_login_id_email', 'reset_password')),
    identifier_hash TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_recovery_attempts_lookup
ON public.account_recovery_attempts (recovery_type, identifier_hash, ip_address, created_at DESC);

CREATE TABLE IF NOT EXISTS public.signup_email_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_email_verifications_lookup
ON public.signup_email_verifications (email, code_hash, consumed_at, expires_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS public.auth_provider_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    provider_display_name TEXT,
    provider_avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_auth_provider_account UNIQUE (provider, provider_user_id),
    CONSTRAINT unique_profile_provider UNIQUE (profile_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_auth_provider_accounts_profile_id
ON public.auth_provider_accounts (profile_id);

CREATE INDEX IF NOT EXISTS idx_auth_provider_accounts_provider_email
ON public.auth_provider_accounts (provider, provider_email)
WHERE provider_email IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    profile_display_name TEXT,
    ip_address TEXT,
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
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_evaluations_user_model UNIQUE (user_id, game_type, actual_model_name)
);

CREATE INDEX IF NOT EXISTS idx_evaluations_user_id ON public.evaluations (user_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_game_type ON public.evaluations (game_type);
CREATE INDEX IF NOT EXISTS idx_evaluations_model ON public.evaluations (actual_model_name);
CREATE INDEX IF NOT EXISTS idx_evaluations_profile_display_name ON public.evaluations (profile_display_name);

CREATE TABLE IF NOT EXISTS public.game_stats (
    game_type TEXT NOT NULL,
    actual_model_name TEXT NOT NULL,
    plays INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (game_type, actual_model_name)
);

CREATE TABLE IF NOT EXISTS public.user_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    display_name TEXT,
    game_type TEXT NOT NULL,
    actual_model_name TEXT NOT NULL,
    viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_views_user_id ON public.user_views (user_id);
CREATE INDEX IF NOT EXISTS idx_user_views_user_game_type ON public.user_views (user_id, game_type);
CREATE INDEX IF NOT EXISTS idx_user_views_user_model ON public.user_views (user_id, actual_model_name);
CREATE INDEX IF NOT EXISTS idx_user_views_display_name ON public.user_views (display_name);

CREATE TABLE IF NOT EXISTS public.comment_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    profile_display_name TEXT NOT NULL,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_comment_reactions_user UNIQUE (evaluation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_reactions_evaluation_id ON public.comment_reactions (evaluation_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id ON public.comment_reactions (user_id);

CREATE TABLE IF NOT EXISTS public.comment_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES public.evaluations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    profile_display_name TEXT NOT NULL,
    reply TEXT NOT NULL CHECK (length(reply) <= 150),
    is_blinded BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comment_replies_evaluation_id ON public.comment_replies (evaluation_id);
CREATE INDEX IF NOT EXISTS idx_comment_replies_user_id ON public.comment_replies (user_id);
CREATE INDEX IF NOT EXISTS idx_comment_replies_profile_display_name ON public.comment_replies (profile_display_name);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_firebase_uid TEXT,
    action TEXT NOT NULL CHECK (
        action IN (
            'comment_blind_toggle',
            'user_suspend',
            'user_unsuspend',
            'user_reset_display_name',
            'user_delete'
        )
    ),
    target_type TEXT NOT NULL CHECK (target_type IN ('comment', 'reply', 'profile')),
    target_id TEXT,
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor
ON public.admin_audit_logs (actor_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
ON public.admin_audit_logs (target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action
ON public.admin_audit_logs (action, created_at DESC);

CREATE OR REPLACE FUNCTION public.increment_game_play_count(
    p_game_type TEXT,
    p_actual_model_name TEXT
)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
    INSERT INTO public.game_stats (game_type, actual_model_name, plays)
    VALUES (p_game_type, p_actual_model_name, 1)
    ON CONFLICT (game_type, actual_model_name)
    DO UPDATE SET plays = game_stats.plays + 1
    RETURNING plays;
$$;

REVOKE ALL ON FUNCTION public.increment_game_play_count(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_game_play_count(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.increment_game_play_count(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_game_play_count(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.purge_privacy_retention_data(
    p_days INTEGER DEFAULT 180
)
RETURNS TABLE (
    evaluations_ip_cleared INTEGER,
    recovery_attempts_deleted INTEGER,
    signup_verifications_deleted INTEGER,
    admin_audit_ip_cleared INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    cutoff TIMESTAMP WITH TIME ZONE := NOW() - make_interval(days => GREATEST(p_days, 30));
BEGIN
    UPDATE public.evaluations
    SET ip_address = ''
    WHERE created_at < cutoff
      AND COALESCE(ip_address, '') <> '';
    GET DIAGNOSTICS evaluations_ip_cleared = ROW_COUNT;

    DELETE FROM public.account_recovery_attempts
    WHERE created_at < cutoff;
    GET DIAGNOSTICS recovery_attempts_deleted = ROW_COUNT;

    DELETE FROM public.signup_email_verifications
    WHERE created_at < cutoff;
    GET DIAGNOSTICS signup_verifications_deleted = ROW_COUNT;

    UPDATE public.admin_audit_logs
    SET ip_address = NULL
    WHERE created_at < cutoff
      AND ip_address IS NOT NULL;
    GET DIAGNOSTICS admin_audit_ip_cleared = ROW_COUNT;

    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_privacy_retention_data(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_privacy_retention_data(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.purge_privacy_retention_data(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_privacy_retention_data(INTEGER) TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_provider_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_recovery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.profiles FROM anon, authenticated;
REVOKE ALL ON public.auth_provider_accounts FROM anon, authenticated;
REVOKE ALL ON public.evaluations FROM anon, authenticated;
REVOKE ALL ON public.game_stats FROM anon, authenticated;
REVOKE ALL ON public.user_views FROM anon, authenticated;
REVOKE ALL ON public.comment_reactions FROM anon, authenticated;
REVOKE ALL ON public.comment_replies FROM anon, authenticated;
REVOKE ALL ON public.account_recovery_attempts FROM anon, authenticated;
REVOKE ALL ON public.signup_email_verifications FROM anon, authenticated;
REVOKE ALL ON public.admin_audit_logs FROM anon, authenticated;

GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.auth_provider_accounts TO service_role;
GRANT ALL ON public.evaluations TO service_role;
GRANT ALL ON public.game_stats TO service_role;
GRANT ALL ON public.user_views TO service_role;
GRANT ALL ON public.comment_reactions TO service_role;
GRANT ALL ON public.comment_replies TO service_role;
GRANT ALL ON public.account_recovery_attempts TO service_role;
GRANT ALL ON public.signup_email_verifications TO service_role;
GRANT ALL ON public.admin_audit_logs TO service_role;

DROP POLICY IF EXISTS "deny_all_anon" ON public.profiles;
DROP POLICY IF EXISTS "deny_all_authenticated" ON public.profiles;
CREATE POLICY "deny_all_anon" ON public.profiles AS RESTRICTIVE FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_authenticated" ON public.profiles AS RESTRICTIVE FOR ALL TO authenticated USING (false);

DROP POLICY IF EXISTS "deny_all_anon" ON public.auth_provider_accounts;
DROP POLICY IF EXISTS "deny_all_authenticated" ON public.auth_provider_accounts;
CREATE POLICY "deny_all_anon" ON public.auth_provider_accounts AS RESTRICTIVE FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_authenticated" ON public.auth_provider_accounts AS RESTRICTIVE FOR ALL TO authenticated USING (false);

DROP POLICY IF EXISTS "deny_all_anon" ON public.evaluations;
DROP POLICY IF EXISTS "deny_all_authenticated" ON public.evaluations;
CREATE POLICY "deny_all_anon" ON public.evaluations AS RESTRICTIVE FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_authenticated" ON public.evaluations AS RESTRICTIVE FOR ALL TO authenticated USING (false);

DROP POLICY IF EXISTS "deny_all_anon" ON public.game_stats;
DROP POLICY IF EXISTS "deny_all_authenticated" ON public.game_stats;
CREATE POLICY "deny_all_anon" ON public.game_stats AS RESTRICTIVE FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_authenticated" ON public.game_stats AS RESTRICTIVE FOR ALL TO authenticated USING (false);

DROP POLICY IF EXISTS "deny_all_anon" ON public.user_views;
DROP POLICY IF EXISTS "deny_all_authenticated" ON public.user_views;
CREATE POLICY "deny_all_anon" ON public.user_views AS RESTRICTIVE FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_authenticated" ON public.user_views AS RESTRICTIVE FOR ALL TO authenticated USING (false);

DROP POLICY IF EXISTS "deny_all_anon" ON public.comment_reactions;
DROP POLICY IF EXISTS "deny_all_authenticated" ON public.comment_reactions;
CREATE POLICY "deny_all_anon" ON public.comment_reactions AS RESTRICTIVE FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_authenticated" ON public.comment_reactions AS RESTRICTIVE FOR ALL TO authenticated USING (false);

DROP POLICY IF EXISTS "deny_all_anon" ON public.comment_replies;
DROP POLICY IF EXISTS "deny_all_authenticated" ON public.comment_replies;
CREATE POLICY "deny_all_anon" ON public.comment_replies AS RESTRICTIVE FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_authenticated" ON public.comment_replies AS RESTRICTIVE FOR ALL TO authenticated USING (false);

DROP POLICY IF EXISTS "deny_all_anon" ON public.account_recovery_attempts;
DROP POLICY IF EXISTS "deny_all_authenticated" ON public.account_recovery_attempts;
CREATE POLICY "deny_all_anon" ON public.account_recovery_attempts AS RESTRICTIVE FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_authenticated" ON public.account_recovery_attempts AS RESTRICTIVE FOR ALL TO authenticated USING (false);

DROP POLICY IF EXISTS "deny_all_anon" ON public.signup_email_verifications;
DROP POLICY IF EXISTS "deny_all_authenticated" ON public.signup_email_verifications;
CREATE POLICY "deny_all_anon" ON public.signup_email_verifications AS RESTRICTIVE FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_authenticated" ON public.signup_email_verifications AS RESTRICTIVE FOR ALL TO authenticated USING (false);

DROP POLICY IF EXISTS "deny_all_anon" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "deny_all_authenticated" ON public.admin_audit_logs;
CREATE POLICY "deny_all_anon" ON public.admin_audit_logs AS RESTRICTIVE FOR ALL TO anon USING (false);
CREATE POLICY "deny_all_authenticated" ON public.admin_audit_logs AS RESTRICTIVE FOR ALL TO authenticated USING (false);

COMMENT ON TABLE public.profiles IS 'Service profiles mapped from Firebase Auth users.';
COMMENT ON COLUMN public.profiles.firebase_uid IS 'Stable Firebase Auth uid. This is the external auth identity.';
COMMENT ON COLUMN public.profiles.role IS 'Server-controlled application role.';
COMMENT ON COLUMN public.profiles.login_id IS 'User-chosen login ID.';
COMMENT ON COLUMN public.profiles.real_name IS 'User-provided account recovery name. Do not display publicly.';
COMMENT ON COLUMN public.profiles.display_name IS 'Public display nickname used on evaluations and comments.';
COMMENT ON COLUMN public.profiles.display_name_set IS 'True when the user explicitly completed display nickname setup.';
COMMENT ON COLUMN public.profiles.email_verification_required IS 'True while core features should be restricted until Firebase email verification is complete.';
COMMENT ON COLUMN public.profiles.social_providers IS 'Linked social providers for the same Firebase uid.';
COMMENT ON COLUMN public.profiles.profile_badge_key IS 'Selected profile badge for account-owned profile rendering.';
COMMENT ON COLUMN public.profiles.display_name_changed_at IS 'Last display_name change timestamp for cooldown enforcement.';
COMMENT ON COLUMN public.profiles.terms_accepted_at IS 'Timestamp when the user accepted the VeilPlays terms of use.';
COMMENT ON COLUMN public.profiles.privacy_accepted_at IS 'Timestamp when the user accepted the VeilPlays privacy policy.';
COMMENT ON COLUMN public.profiles.policy_version IS 'Application policy version accepted by the user.';

COMMENT ON TABLE public.account_recovery_attempts IS 'Rate-limit and audit table for account recovery attempts.';
COMMENT ON TABLE public.signup_email_verifications IS 'Signup email pre-verification codes.';
COMMENT ON TABLE public.auth_provider_accounts IS 'External OAuth provider accounts linked to VeilPlays profiles.';
COMMENT ON TABLE public.user_views IS 'Per-account game/model view history.';
COMMENT ON TABLE public.admin_audit_logs IS 'Server-side audit trail for admin moderation and account actions.';
COMMENT ON FUNCTION public.purge_privacy_retention_data(INTEGER) IS 'Clears or deletes IP-bearing operational records older than the configured retention period.';

NOTIFY pgrst, 'reload schema';
