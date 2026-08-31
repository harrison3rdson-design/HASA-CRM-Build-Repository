# Phase 6 Integration

Phase 6 turns the Release 1 shell into an interactive application using Next.js Server Actions.

Implemented action modules:
- clients/contacts
- proposals and revisions
- timer start/stop
- manual time entry
- expenses
- receipt upload
- additional services
- invoices
- invoice items
- invoice issue
- payments
- document upload
- company settings

Reusable interactive form/components are included for the most important operations.

## Security notes

Server Actions must always call `requireUser()` before touching business records.

Several actions use the admin/service client after authentication because the underlying operation spans multiple tables, storage, or security-definer RPCs. Before go-live, add explicit role checks in these actions rather than relying only on "authenticated user".

Recommended helper:
`requireRole(["owner_admin","project_manager"])`

Use stricter checks for:
- invoice issue
- payment posting
- company settings
- user/role management
- document delivery

## Receipt upload

Receipt upload currently:
- requires authentication
- limits files to 15 MB
- accepts JPEG, PNG, WEBP, or PDF
- writes to the private receipt bucket
- creates `expense_attachments` metadata

Add malware scanning if deployment policy requires it.

## Invoice creation

Draft invoice creation requests the next per-project invoice number. If gapless invoice numbering is a legal/accounting requirement, allocate the final number at issue time rather than draft creation.

## Proposal revisions

Revision creation copies:
- sections
- fee items
- expense estimates

The accepted revision remains immutable.

## Next phase

Phase 7 should wire these forms directly into each page, add modal/drawer UX, implement proposal and invoice detail pages, and complete the mobile client acceptance pages.
