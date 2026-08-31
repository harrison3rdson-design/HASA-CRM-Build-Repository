# Phase 8 Acceptance & Delivery Tests

1. Send proposal by SMS, email, and both.
2. Verify only hashed token is stored.
3. Verify old active token is revoked when a new link is generated.
4. Open mobile proposal link and verify `sent -> viewed`.
5. Accept proposal and verify:
   - signer data recorded
   - IP/user-agent recorded
   - executed PDF generated
   - SHA-256 stored
   - accepted revision locked
   - proposal marked accepted
   - share link revoked
   - project created once
   - audit event written
6. Retry accepted token and verify rejection.
7. Repeat equivalent tests for additional-service authorization.
8. Verify accepted additional service increases authorized fee without altering original contract amount.
9. Generate invoice PDF and verify totals against database.
10. Send invoice by SMS/email and verify delivery record.
11. Confirm all generated files reside in private storage.
12. Confirm signed invoice URL expires.
13. Confirm no service-role credentials are sent to browser.
