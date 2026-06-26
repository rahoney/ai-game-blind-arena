-- Admin audit trail for moderation and account operations.
-- Run this after 013_atomic_game_play_count.sql.

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
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
ON admin_audit_logs (actor_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
ON admin_audit_logs (target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action
ON admin_audit_logs (action, created_at DESC);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON admin_audit_logs FROM anon;
REVOKE ALL ON admin_audit_logs FROM authenticated;

DROP POLICY IF EXISTS "deny_all_anon" ON admin_audit_logs;
DROP POLICY IF EXISTS "deny_all_authenticated" ON admin_audit_logs;

CREATE POLICY "deny_all_anon"
ON admin_audit_logs AS RESTRICTIVE FOR ALL TO anon
USING (false);

CREATE POLICY "deny_all_authenticated"
ON admin_audit_logs AS RESTRICTIVE FOR ALL TO authenticated
USING (false);

COMMENT ON TABLE admin_audit_logs IS
'Server-side audit trail for admin moderation and account actions. Direct anon/authenticated access is denied.';

NOTIFY pgrst, 'reload schema';
