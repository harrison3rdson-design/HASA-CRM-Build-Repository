# HASA Concepts Management — Release 1 Cumulative v0.9

This is the consolidated staging build assembled from Release 1 Phases 1 through 9.

## Use this package for staging
Do not assemble the earlier phase ZIPs manually for a new deployment. This cumulative package includes:
- corrected Phase 1 migration ordering
- corrected Phase 8 acceptance migration
- Phase 9 compatibility migration
- operational UI and forms
- mobile acceptance UI and server workflows
- proposal/project/invoice lifecycle services
- receipt storage and receipt appendix support
- actual HASA branding image assets
- RLS/role helper foundation
- PDF generation pipeline
- SMS/email provider boundaries
- staging integration and go-live checklists

## Not yet a live production deployment
Credential-dependent integrations and staging tests remain. See `docs/GO_LIVE_BLOCKERS.md`.

## Database migration order
1. 001_release1_foundation.sql
2. 002_release1_operations_billing.sql
3. 003_release1_documents_delivery.sql
4. 004_release1_production_hardening.sql
5. 005_release1_acceptance_delivery.sql  (corrected cumulative version)
6. 006_release1_phase9_hardening.sql
