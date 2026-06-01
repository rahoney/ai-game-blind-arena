-- Account system phase 7: backfill legacy display-name rows to account ids.
-- This keeps old visible evaluations/comments while moving ownership to profiles.id.

WITH matched AS (
    SELECT
        e.id AS evaluation_id,
        p.id AS profile_id,
        p.display_name,
        ROW_NUMBER() OVER (
            PARTITION BY p.id, e.game_type, e.actual_model_name
            ORDER BY e.updated_at DESC NULLS LAST, e.created_at DESC NULLS LAST, e.id
        ) AS rn
    FROM evaluations e
    JOIN profiles p ON LOWER(e.nickname) = LOWER(p.display_name)
    WHERE e.user_id IS NULL
)
UPDATE evaluations e
SET
    user_id = matched.profile_id,
    profile_display_name = COALESCE(e.profile_display_name, matched.display_name)
FROM matched
WHERE e.id = matched.evaluation_id
  AND matched.rn = 1;

WITH matched AS (
    SELECT
        cr.id AS reaction_id,
        p.id AS profile_id,
        ROW_NUMBER() OVER (
            PARTITION BY cr.evaluation_id, p.id
            ORDER BY cr.updated_at DESC NULLS LAST, cr.created_at DESC NULLS LAST, cr.id
        ) AS rn
    FROM comment_reactions cr
    JOIN profiles p ON LOWER(cr.nickname) = LOWER(p.display_name)
    WHERE cr.user_id IS NULL
)
UPDATE comment_reactions cr
SET user_id = matched.profile_id
FROM matched
WHERE cr.id = matched.reaction_id
  AND matched.rn = 1;

WITH matched AS (
    SELECT
        reply.id AS reply_id,
        p.id AS profile_id
    FROM comment_replies reply
    JOIN profiles p ON LOWER(reply.nickname) = LOWER(p.display_name)
    WHERE reply.user_id IS NULL
)
UPDATE comment_replies reply
SET user_id = matched.profile_id
FROM matched
WHERE reply.id = matched.reply_id;

NOTIFY pgrst, 'reload schema';
