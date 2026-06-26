-- Privacy retention helper for IP-bearing operational records.
-- Run this after 014_admin_audit_logs.sql.
--
-- The function does not run automatically. Call it from a scheduled job or
-- Supabase SQL editor after confirming the retention period in the privacy policy.

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
    UPDATE evaluations
    SET ip_address = ''
    WHERE created_at < cutoff
      AND COALESCE(ip_address, '') <> '';
    GET DIAGNOSTICS evaluations_ip_cleared = ROW_COUNT;

    DELETE FROM account_recovery_attempts
    WHERE created_at < cutoff;
    GET DIAGNOSTICS recovery_attempts_deleted = ROW_COUNT;

    DELETE FROM signup_email_verifications
    WHERE created_at < cutoff;
    GET DIAGNOSTICS signup_verifications_deleted = ROW_COUNT;

    UPDATE admin_audit_logs
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

COMMENT ON FUNCTION public.purge_privacy_retention_data(INTEGER) IS
'Clears or deletes IP-bearing operational records older than the configured retention period.';

NOTIFY pgrst, 'reload schema';
