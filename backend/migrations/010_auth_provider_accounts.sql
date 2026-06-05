-- Map external OAuth provider accounts to VeilPlays profiles.
-- This supports backend OAuth flows that sign in through Firebase custom tokens.

CREATE TABLE IF NOT EXISTS auth_provider_accounts (
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

CREATE INDEX IF NOT EXISTS idx_auth_provider_accounts_profile_id
ON auth_provider_accounts (profile_id);

CREATE INDEX IF NOT EXISTS idx_auth_provider_accounts_provider_email
ON auth_provider_accounts (provider, provider_email)
WHERE provider_email IS NOT NULL;

COMMENT ON TABLE auth_provider_accounts IS
'Maps external OAuth provider accounts such as Kakao/Naver/GitHub to VeilPlays account profiles.';

COMMENT ON COLUMN auth_provider_accounts.provider IS
'External auth provider key, e.g. kakao, naver, github.';

COMMENT ON COLUMN auth_provider_accounts.provider_user_id IS
'Stable user id from the external provider. This, not email, is the trusted provider identity.';

COMMENT ON COLUMN auth_provider_accounts.profile_id IS
'Linked VeilPlays profile id. Delete this mapping when an account is anonymized/deleted.';

NOTIFY pgrst, 'reload schema';
