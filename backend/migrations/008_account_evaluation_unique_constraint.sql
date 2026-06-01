-- Account system phase 8: add a non-partial uniqueness constraint for account evaluations.
-- PostgREST upsert cannot reliably target partial unique indexes. The backend
-- now uses select/update/insert, but this keeps the database invariant explicit.

DROP INDEX IF EXISTS unique_evaluations_user_model;

ALTER TABLE evaluations
DROP CONSTRAINT IF EXISTS unique_evaluations_user_model;

ALTER TABLE evaluations
ADD CONSTRAINT unique_evaluations_user_model
UNIQUE (user_id, game_type, actual_model_name);

NOTIFY pgrst, 'reload schema';
