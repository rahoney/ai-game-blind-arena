-- Signup email pre-verification codes sent through Brevo.

CREATE TABLE IF NOT EXISTS signup_email_verifications (
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
ON signup_email_verifications (email, code_hash, consumed_at, expires_at DESC, created_at DESC);
