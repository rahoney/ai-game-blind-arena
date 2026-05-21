-- Account recovery phase 3: distinguish full login-id email sends from lookup attempts.
-- Run this after 002_profile_identity_recovery_policy.sql if 002 was already applied.

ALTER TABLE account_recovery_attempts
DROP CONSTRAINT IF EXISTS account_recovery_attempts_recovery_type_check;

ALTER TABLE account_recovery_attempts
ADD CONSTRAINT account_recovery_attempts_recovery_type_check
CHECK (recovery_type IN ('find_login_id', 'send_login_id_email', 'reset_password'));
