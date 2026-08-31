# Release 1 Cross-Phase Compatibility Audit

Phase 9 identified and corrected important issues before the cumulative build.

1. Phase 1 originally created `current_app_user_id()` before `app_users` existed. The cumulative migration copy moves that function below the `app_users` table definition.

2. The Phase 8 acceptance migration used several names/states that did not match the earlier schema:
   - `projects.source_proposal_revision_id` should be `projects.source_revision_id`.
   - `projects.authorized_fee` is a generated column and must not be assigned directly.
   - `activity_log` uses `record_type`, `record_id`, and `new_values`, not `metadata`.
   - `additional_services` originally had no `locked` column.
   - `proposals` originally had no `sent_at` or `accepted_at`.

The cumulative build contains a corrected Phase 8 migration plus the Phase 9 compatibility migration.

3. Generated-document field names are standardized to the Phase 3 schema:
   - `original_filename`
   - `sha256_hash`
   - `generated_at`

4. Invoice tax is standardized to `tax_amount`, matching the Phase 2 schema.

5. Public token acceptance remains server-only. No anonymous table policy is introduced.

The cumulative build should be used for a fresh staging deployment instead of independently applying the earlier experimental Phase 8 migration.
