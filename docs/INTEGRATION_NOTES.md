# Phase 5 Integration Notes

This package supplies the Release 1 user-facing application shell for HASA Concepts Management.

The screens are wired to the database/query layer created in prior phases:
Dashboard, Clients, Proposals, Projects, Time, Expenses, Receipt Inbox, Billing, Documents, Reports, and Settings.

The buttons are intentionally not fake mutations. Phase 6 should wire real validated server actions for:
client/contact CRUD; proposal builder/revisions/sending; timer start/stop; manual time; expense/receipt upload; additional services; invoice builder; payment posting; document upload; settings updates.

Important: `app-data.ts` uses the server-side admin client for concise integration. Before production deployment, calls should be moved behind explicit authorization or use the authenticated server client/RLS. Never expose the service-role key to browser code.

Branding: replace the sidebar text fallback with the configured square HASA logo. Customer-facing documents should continue to use the configured horizontal logo.
