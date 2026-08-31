# Release 1 Staging Integration Checklist

## Security
- Create users for all five roles.
- Verify read_only cannot mutate any business record.
- Verify staff cannot issue invoices, post payments, change company settings, or change user roles.
- Verify accounting can issue invoices and post payments but cannot change user roles.
- Verify project_manager can manage proposals/projects/additional services.
- Verify owner_admin has intended full access.
- Confirm service-role key never appears in browser bundles.

## Proposal lifecycle
- Create client/contact.
- Create proposal and revision.
- Add sections, fees, and travel estimates.
- Send public link.
- Confirm only token hash is persisted.
- View from mobile.
- Accept.
- Verify executed PDF has HASA branding, signature metadata, and stable SHA-256.
- Verify project is created once.
- Verify acceptance token is revoked.

## Operations
- Start timer; verify second active timer for same user is rejected.
- Stop timer and verify calculated duration.
- Add manual time.
- Add expense.
- Upload JPEG receipt.
- Upload PDF receipt.
- Verify private signed access only.

## Additional services
- Create authorization.
- Send and accept from mobile.
- Confirm original contract does not change.
- Confirm additional-services amount and generated authorized fee update correctly.

## Billing
- Create advance/progress/hourly/expense/final invoices.
- Add items.
- Issue invoice.
- Generate branded invoice.
- Include expense detail.
- Include receipt appendix.
- Verify image receipts render and PDF receipts are referenced.
- Send invoice.
- Record partial/full payments.
- Verify past-due job.

## Recovery
- Restore database backup into staging.
- Verify storage paths.
- Re-run representative PDF generation.
- Confirm hashes for already-issued documents remain unchanged.
