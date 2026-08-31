# Release 1 End-to-End Test Matrix

## Authentication / roles
- Anonymous user cannot query internal tables.
- Staff can create/edit own unlocked time.
- Staff cannot issue invoices or record payments.
- Project manager can manage proposals/projects/additional services.
- Accounting can create/issue invoices and record payments.
- Read-only user cannot mutate records.
- Owner/Admin has all internal permissions.

## Proposal acceptance
- Valid token loads only the intended proposal revision.
- Expired/revoked token fails.
- Accepted revision becomes immutable.
- Acceptance creates project exactly once.
- Executed PDF hash/path are stored.
- Acceptance token cannot be reused.

## Time / expenses
- Time entry records billing rate and internal cost rate.
- Travel time is distinguishable.
- Expense stores actual cost separately from billable amount.
- Multiple receipts can attach to one expense.
- Receipt Inbox can be assigned to a project/expense.
- Invoiced time/expense cannot be modified or deleted.

## Additional services
- Numbering increments per project.
- Accepted authorization increases authorized fee.
- Original contract amount remains unchanged.
- Accepted authorization becomes immutable.
- Executed authorization hash/path are retained.

## Invoicing
- Invoice numbering increments per project.
- Unbilled time/expenses can be linked only once.
- Issuing invoice locks source entries.
- Progress/advance/milestone/hourly/expense/final invoice types work.
- Optional expense detail is generated when selected.
- Optional receipt appendix is included when selected.
- Final combined PDF hash matches stored hash.

## Payments
- Partial payment changes invoice to partial.
- Full payment changes invoice to paid.
- Payment above balance is rejected.
- Payment cannot be posted to void invoice.

## Past due
- Open invoice past due date becomes past_due.
- Paid/void invoice is not marked past_due.

## Storage
- Buckets are private.
- Signed URL expires.
- Customer cannot enumerate storage objects.
- Receipt/document access requires authorized server path.

## Recovery
- Database backup restored into test environment.
- Stored document paths remain resolvable after restore.
