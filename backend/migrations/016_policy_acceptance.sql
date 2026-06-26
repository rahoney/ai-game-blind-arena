-- Phase 6: record terms/privacy policy acceptance for newly completed accounts.
-- Run in Supabase SQL Editor before deploying the matching application code.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS policy_version TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_policy_version
ON public.profiles (policy_version);

COMMENT ON COLUMN public.profiles.terms_accepted_at IS
'Timestamp when the user accepted the VeilPlays terms of use.';

COMMENT ON COLUMN public.profiles.privacy_accepted_at IS
'Timestamp when the user accepted the VeilPlays privacy policy.';

COMMENT ON COLUMN public.profiles.policy_version IS
'Application policy version accepted by the user, for future re-consent tracking.';
