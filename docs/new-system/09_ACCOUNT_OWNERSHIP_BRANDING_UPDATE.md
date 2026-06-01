# Account Ownership and Branding Update

Date: 2026-06-01

## Summary

This update moves service writes from legacy nickname ownership toward Firebase account ownership, and updates the public service brand from `AI Game Blind Arena` to `VeilPlays`.

`AI Game Blind Arena` remains as the experiment subtitle/context, while `VeilPlays` is now the primary service name used in the application shell, authentication screens, email copy, About page, and policy text.

## Account Ownership

- Evaluation writes now require a Firebase-authenticated account.
- New evaluations are owned by `profiles.id` through `evaluations.user_id`.
- The legacy `nickname` field remains only as a display-name snapshot for comments/results.
- Comment reactions and replies now use `user_id` for ownership.
- Profile badge persistence now targets `profiles.profile_badge_key`.
- My Page and current-user evaluation reads prefer account-owned data.
- Legacy nickname tables are treated as compatibility/fallback read paths only where needed for old data visibility.

## Database Migrations Added

- `005_account_owned_activity.sql`
  - Adds account-owned activity columns and tables.
  - Adds `profiles.profile_badge_key`, `evaluations.user_id`, `user_views`, `comment_reactions.user_id`, and `comment_replies.user_id`.
- `006_evaluations_compat_columns.sql`
  - Aligns deployed `evaluations` tables with the backend write/read surface.
  - Requests PostgREST schema cache reload.
- `007_backfill_account_activity_user_ids.sql`
  - Backfills legacy rows by matching `evaluations.nickname` / comment author nicknames to `profiles.display_name`.
- `008_account_evaluation_unique_constraint.sql`
  - Adds a non-partial uniqueness constraint for `(user_id, game_type, actual_model_name)`.
  - The backend no longer depends on PostgREST `upsert` for evaluation saves; it uses select/update/insert.

## Email and Recovery

- Password reset email copy is sent through Brevo.
- Reset email language follows the current UI language (`ko` or `en`).
- Mail brand is `VeilPlays`, with `AI Game Blind Arena` used only as supporting context.

## UI Branding

- Browser title and fixed header use `VeilPlays`.
- Login/auth cards show `VeilPlays` with `AI Game Blind Arena` as a subtitle.
- Sidebar title uses `VeilPlays`.
- About page now frames the service as `VeilPlays`, with `AI Game Blind Arena` as the core experiment.
- Footer keeps only the copyright line and privacy policy link.

## Notes

- Generated game HTML files were not mass-edited. Their embedded titles are treated as model output artifacts rather than the application shell brand.
- Legacy nickname validation and display-name validation still share parts of the same validation helper. That should be separated later if display-name policy changes independently from old nickname rules.
