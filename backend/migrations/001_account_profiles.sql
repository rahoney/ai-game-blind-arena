-- Account system phase 1: Firebase Auth profile mapping.
-- Run this before enabling account-based API writes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
    provider TEXT,
    email TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON profiles (firebase_uid);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles (email);

COMMENT ON TABLE profiles IS 'Service profiles mapped from Firebase Auth users.';
COMMENT ON COLUMN profiles.firebase_uid IS 'Stable Firebase Auth uid. This is the external auth identity.';
COMMENT ON COLUMN profiles.role IS 'Server-controlled application role. Clients must not set or trust this value.';
