# HASA Concepts Release 1 — Deployment Checklist

## Infrastructure
- Create production Supabase project.
- Enable automated database backups.
- Create private `hasa-documents` bucket.
- Create private `hasa-receipts` bucket.
- Configure custom application domain.
- Configure TLS/HTTPS.
- Configure environment secrets outside source control.

## Database
- Apply migrations 001 → 004 in order.
- Create first Owner/Admin auth user.
- Link auth user to `app_users`.
- Confirm RLS is enabled on every business table.
- Run role/permission test matrix.

## Documents
- Upload HASA horizontal logo to protected application branding storage.
- Upload HASA square logo.
- Populate `company_settings`.
- Configure Playwright/Chromium PDF generation.
- Verify proposal, executed proposal, invoice, and authorization PDFs.
- Verify SHA-256 hashes.

## Messaging
- Configure SMS provider.
- Configure transactional email provider.
- Verify delivery IDs/status are saved.
- Confirm opt-out/compliance text where required.
- Confirm mobile public pages do not expose internal data.

## Billing
- Verify invoice numbering format.
- Verify NET 15 default.
- Verify progress/advance/final invoice paths.
- Verify time/expense duplicate-billing protection.
- Verify receipt appendix generation.

## Automation
- Schedule `mark_past_due_invoices` daily using a protected cron endpoint.
- Configure error monitoring.
- Configure application/server logs.
- Alert on failed document delivery.

## Backup / restore
- Perform a full test restore before go-live.
- Confirm generated PDF objects and database metadata match after restore.
- Document recovery credentials/process securely.

## Go-live
- Import real clients.
- Create real internal users.
- Confirm branding.
- Create one internal test proposal.
- Send test proposal by SMS/email.
- Accept from mobile device.
- Verify project auto-creation.
- Log test time and expense with receipt.
- Generate test progress invoice.
- Record test payment.
- Archive or delete test records according to policy.
