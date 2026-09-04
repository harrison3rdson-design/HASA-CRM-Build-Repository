# HASA Concepts backup and recovery

## What the recovery package protects

Each package contains:

- all rows from every application-owned `public` table;
- every file from every Supabase Storage bucket;
- the complete checked-in database migration history;
- a manifest with record and file counts; and
- SHA-256 checksums for corruption detection.

The package intentionally does not contain database passwords, Vercel secrets, Supabase service-role keys, password hashes, sessions, or authenticator secrets.

## Recovery targets

- Recovery point objective: the timestamp shown in `snapshot-manifest.json`.
- Recovery time objective for this small system: four hours after administrator access and required provider credentials are available.
- Backup frequency after launch: weekly and immediately before schema changes, bulk imports, or a production-data reset.
- Retention: keep the latest four weekly packages and one month-end package for twelve months.

## Creating a package

The normal method is available to an Owner Administrator under **Settings > Backup & Recovery**.
Select **Download Recovery Backup**, then move the downloaded JSON file to an encrypted external drive
or encrypted cloud vault. Do not add the file to Git. The download requires an active owner session and
completed MFA challenge, and browsers and intermediary systems are instructed not to cache it.

The downloaded JSON contains table data, bucket configuration, private stored files encoded as Base64,
record and file counts, and SHA-256 hashes.

An authorized developer who already has a local-only copy of the required production environment values
may instead create a directory-form package. The temporary environment file must remain outside Git and
must be deleted immediately after the package passes verification.

Example command structure (values deliberately omitted):

```text
node scripts/create-recovery-package.mjs --env TEMP_ENV_FILE --output NEW_BACKUP_DIRECTORY --migrations supabase/migrations --project-ref PROJECT_REF --commit GIT_COMMIT
```

## Recovery procedure

Never restore directly over production first.

1. Create an empty recovery Supabase project in the same region.
2. Apply the migrations from `schema/migrations` in filename order.
3. Recreate the owner login from the Supabase Authentication dashboard. The owner must set a new password and enroll MFA again.
4. Restore `protectedData.tables` from the JSON backup in foreign-key order using an administrator-only import process. Share-link tokens and acceptance records are sensitive and must remain private throughout the restore.
5. Recreate the Storage buckets from `protectedData.storage.buckets`, decode each `protectedData.storage.objects[].contentBase64`, and upload it to the recorded bucket and object path.
6. Configure the recovery deployment with newly issued Supabase, Resend, Twilio, and Turnstile credentials. Do not reuse exposed or retired secrets.
7. Verify sign-in and MFA, client/contact access, proposal preview and acceptance, project time and expenses, additional services, invoice preview and delivery, and private document downloads.
8. Compare recovery row counts, object counts, object sizes, and checksums with the manifest.
9. Only after the recovery environment passes verification should DNS or production traffic be redirected.

## Full PostgreSQL logical backup

The application-level package is designed for practical recovery of HASA-owned records and files. For a full PostgreSQL logical dump, use the Supabase CLI `db dump` workflow with the database password from the Supabase Database Settings page. Supabase excludes managed schemas by default; create separate schema, data, and role dumps according to the current Supabase backup-and-restore documentation.

Supabase database backups contain Storage metadata but not the stored file contents. The separate Storage payload in this package is therefore required.

## Quarterly recovery drill

Once per quarter:

1. create a fresh package;
2. restore it into a non-production project;
3. run the complete verification flow;
4. record the start time, finish time, discrepancies, and corrective actions; and
5. destroy the temporary recovery project after the result is documented.

## Emergency contacts and access

Keep the following in a separate password manager entry, not in this repository or backup package:

- Supabase organization owner and recovery codes;
- Vercel team owner and recovery codes;
- domain registrar access;
- Resend, Twilio, and Cloudflare owner access; and
- the location and unlock method for the encrypted off-site backup.
