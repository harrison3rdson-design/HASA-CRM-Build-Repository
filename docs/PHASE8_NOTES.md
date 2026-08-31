# Phase 8 — Live Acceptance, Delivery & Executed Documents

Phase 8 replaces the principal public acceptance scaffolds with working server routes and database transactions.

## Completed in this increment
- secure random share-token creation
- hash-only token storage
- revocation of older active links
- proposal view registration
- additional-service view registration
- proposal send workflow
- additional-service send workflow
- proposal acceptance transaction
- additional-service acceptance transaction
- signer metadata capture
- IP/user-agent capture
- executed PDF generation
- SHA-256 document hashing
- private PDF storage
- link revocation after acceptance
- project creation from accepted proposal
- authorized-fee increase after accepted additional service
- invoice PDF generation
- invoice send workflow
- delivery history recording

## Provider boundary
The SMS and email adapters created in Phase 4 still require actual provider credentials/SDK configuration. The workflow code is now connected to those adapters, but no message can actually leave the system until the provider adapters are configured.

## Important production hardening
The PDF is uploaded before the acceptance database transaction. If the transaction fails after upload, an orphan PDF may remain. Production cleanup should either:
- delete the object in the catch path, or
- enqueue an orphan-object cleanup job.

For the strongest executed-document integrity, render the final PDF using a transaction timestamp returned from the database rather than the application clock.

## Next phase
Phase 9 should focus on:
- final role checks in every privileged server action
- confirmation delivery of executed documents
- proposal/invoice document branding using the actual configured HASA logo
- receipt appendix composition
- end-to-end staging seed data
- automated integration tests
- cumulative build package
