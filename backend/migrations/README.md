# Database Migrations

`001_baseline_schema.sql` is the canonical schema for a new Supabase environment.

For a new environment:

1. Create a fresh Supabase project.
2. Open Supabase SQL Editor.
3. Run `001_baseline_schema.sql` once.
4. Configure backend environment variables and deploy the application.

Do not run the historical phase migrations from earlier development. They were
consolidated into the baseline on 2026-07-01.

Future database changes should be added as new incremental files, starting with
`002_*.sql`, and should assume that `001_baseline_schema.sql` has already been
applied.
