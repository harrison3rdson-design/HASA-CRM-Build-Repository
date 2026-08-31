# HASA Concepts Release 1 — Phase 12 Vercel Handoff

Status: Supabase Release 1 schema is deployed. Vercel project and Next.js deployment pipeline are validated with a smoke deployment.

## Required source deployment
Deploy this repository root to the existing Vercel project `hasa-concepts-management` in the HASA Concepts team.

## Required environment variables
- NEXT_PUBLIC_SUPABASE_URL=https://xlwrztrjlngokrxdktgk.supabase.co
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
- SUPABASE_SERVICE_ROLE_KEY=<server-only secret; do not expose to browser>
- NEXT_PUBLIC_APP_URL=<assigned Vercel URL>
- PRIVATE_STORAGE_BUCKET=<configured private bucket name>

Messaging variables are optional until delivery testing:
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_FROM_NUMBER
- EMAIL_PROVIDER_API_KEY
- EMAIL_FROM
- EMAIL_PROVIDER_URL

## Phase 12 fix
A missing root `src/app/layout.tsx` was added so Next.js App Router has the required root layout.

## Validation still required after full source deployment
1. Vercel production build completes with the full source tree.
2. Authenticated app loads against Supabase.
3. Proposal acceptance creates exactly one project and locks the accepted revision.
4. Private storage and signed receipt/document URLs work.
5. Invoice issue/payment workflow works and source time/expenses lock correctly.
6. Branded PDF generation works in the Vercel runtime.
7. RLS/role tests pass for owner, PM, staff, accounting, and read-only roles.
