# HASA Concepts Release 1 — Staging Deployment Runbook

1. Create a new staging Supabase project.
2. Create private buckets `hasa-documents` and `hasa-receipts`.
3. Apply migrations 001 through 006 in numeric order.
4. Run `tests/sql/001_core_invariants.sql`.
5. Create the first Auth user.
6. Insert the matching `app_users` row with `owner_admin`.
7. Configure the application environment variables from `.env.release1.example`.
8. Install dependencies with Node 22+.
9. Install the Chromium runtime required by Playwright.
10. Deploy the Next.js application.
11. Open the protected production-health endpoint and resolve every false check.
12. Run the staging seed only if test data is desired.
13. Execute the full workflow manually from proposal through payment.
14. Configure Twilio and email provider credentials.
15. Send test messages only to authorized test recipients.
16. Verify mobile proposal acceptance on iOS and Android-class viewport sizes.
17. Verify executed proposal and invoice PDFs on screen and print.
18. Test database backup and restore.
19. Review RLS/role behavior for all five roles.
20. Promote to production only after the staging checklist passes.
